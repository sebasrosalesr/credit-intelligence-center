// src/App.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ref, set, update, push, get, query, orderByChild, equalTo, remove, onValue } from "firebase/database";
import { db, auth } from "./firebase";
import { useFirebaseCredits } from "./hooks/useFirebaseCredits";
import { MOCK_CREDITS } from "./mockCredits";
import { FileText, ShieldAlert, AlertTriangle, BarChart2, Sun, Moon, Clock3 } from "lucide-react";
import CreditsTable from "./components/table/CreditsTable.jsx";
import SummaryCard from "./components/common/SummaryCard.jsx";
import DashboardTab from "./components/tabs/DashboardTab.jsx";
import EditRecordsTab from "./components/tabs/EditRecordsTab.jsx";
import AlertsFollowUpsTab from "./components/tabs/AlertsFollowUpsTab.jsx";
import KpisTab from "./components/tabs/KpisTab.jsx";
import RiskScoresTab from "./components/tabs/RiskScoresTab.jsx";
import DetailDrawer from "./components/DetailDrawer.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import AiIntakeView from "./components/tabs/AiIntakeView.jsx";
import { useLogger } from "./monitoring/logger.jsx";
import { toNumber, formatCurrency } from "./utils/format";
import { computeRiskIndex, getSlaBadge } from "./utils/risk";
import ErrorBoundary, { TabErrorBoundary, ComponentErrorBoundary } from "./components/ErrorBoundary.jsx";
import { initPerformanceMonitoring } from "./utils/performance.ts";

// Initialize performance monitoring
initPerformanceMonitoring();
import {
  computeAging,
  extractLatestStatusLabel,
  getStrictReminderTicketKey,
  getWorkflowState,
} from "./utils/recordHelpers";
import { useReminders } from "./hooks/useReminders.ts";
import { useFilters } from "./hooks/useFilters.ts";
import { useAppState } from "./hooks/useAppState";
import Login from "./components/auth/Login.jsx";
import { onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";
import { API_BASE } from "./config/apiBase";
import { TEXT } from "./config/textStyles";
import { currentDbUrl, firebaseEnv, sandboxCredJsonPath } from "./config/firebaseEnv";
import { CREDIT_TYPES, SALES_REPS } from "./config/constants";

const STATUS_OPTIONS = ["All", "Pending", "Completed"];

const TAB_CONFIG = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: BarChart2,
    roles: ["read-only", "credit", "owner", "manager", "view"],
  },
  {
    key: "edit",
    label: "Edit Records",
    icon: FileText,
    roles: ["credit", "owner"],
  },
  {
    key: "ic",
    label: "Credit Aging Hub",
    icon: AlertTriangle,
    roles: ["read-only", "credit", "owner"],
  },
  {
    key: "kpis",
    label: "KPIs / Charts",
    icon: BarChart2,
    roles: ["read-only", "credit", "owner", "manager", "view"],
  },
  {
    key: "risk",
    label: "Risk Scores (Beta)",
    icon: ShieldAlert,
    roles: ["read-only", "credit", "owner"],
  },
  {
    key: "ai_intake",
    label: "AI Intake Engine",
    icon: FileText,
    roles: ["credit", "owner"],
  },
];

const ROLE_DISPLAY_NAMES = {
  owner: "Owner",
  credit: "Credit Owner",
  "read-only": "Read-only",
  manager: "Manager",
  view: "Manager",
};

const AUTHOR_ALIAS_MAP = {
  srosalestwinmed: "SR",
  srosales: "SR",
  dwatts: "DW",
  jfreeman: "JF",
};

// =======================
// Helper functions
// =======================

function parseBulkList(str) {
  if (!str) return new Set();
  const parts = String(str)
    .split(/[\s,;\n\r\t]+/)
    .map((s) => normalizeKey(s))
    .filter(Boolean);
  return new Set(parts);
}

function normalizeKey(val) {
  const raw = String(val || "").trim().toLowerCase();
  if (!raw) return "";
  // strip non-alphanumeric
  const cleaned = raw.replace(/[^a-z0-9]/g, "");
  // drop leading "inv" if present (e.g., inv12345 -> 12345) to match plain invoice numbers
  if (cleaned.startsWith("inv") && cleaned.length > 3) {
    return cleaned.slice(3);
  }
  return cleaned;
}

// Pending / Completed based on RTN_CR_No:
// if RTN_CR_No is empty, null, undefined, "" or "nan" -> Pending
// otherwise -> Completed
function parseReminderDate(reminder) {
  if (!reminder) return null;
  const base = reminder.snoozed_until || reminder.due_date;
  if (!base) return null;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getIndyTimestamp() {
  const now = new Date();
  const tzFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = tzFormatter.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

const getRecordKey = (rec, idx = 0) => {
  const inv = String(rec["Invoice Number"] || "").trim() || "inv";
  const item = String(rec["Item Number"] || "").trim() || "item";
  const ticket = String(rec["Ticket Number"] || rec.TicketNumber || "").trim() || "ticket";
  const date = String(rec.Date || "").trim() || "date";
  return rec.id || `${inv}|${item}|${ticket}|${date}|${idx}`;
};

function getRecordId(rec) {
  return rec?.id ?? rec?.Id ?? rec?.ID ?? null;
}

function getInvoiceItemCombo(rec) {
  const invoice = rec?.["Invoice Number"];
  const item = rec?.["Item Number"];
  if (invoice && item) {
    return `${invoice}|${item}`;
  }
  return rec?.combo_key || null;
}

function isSameCreditRecord(a, b) {
  if (!a || !b) return false;
  const idA = getRecordId(a);
  const idB = getRecordId(b);
  if (idA && idB) return idA === idB;
  const comboA = getInvoiceItemCombo(a);
  const comboB = getInvoiceItemCombo(b);
  if (comboA && comboB) return comboA === comboB;
  return false;
}

// =======================
// Main component
// =======================

function getFirebaseReminderKey(reminder) {
  return (
    reminder?.firebaseKey ||
    reminder?.firebase_key ||
    reminder?.__firebaseKey ||
    reminder?.__key ||
    null
  );
}

function AuthenticatedApp({ userRole, authUser, onLogout }) {
  const { logClientEvent } = useLogger();
  const [theme] = useState("dark");
  const { liveCredits, setLiveCredits, firebaseStatus, lastLiveRefresh } =
    useFirebaseCredits(logClientEvent);

  // Use live data if available, otherwise mock
  const sourceCredits = firebaseStatus === "live" ? liveCredits : MOCK_CREDITS;

  // Use the reminders hook for centralized reminder management
  const {
    remindersMapByKey,
    reminderKeyByTicket,
    remindersLoaded,
    creditsWithReminders,
    cacheReminderSafe,
  } = useReminders(db, sourceCredits, logClientEvent);

  // Use the hook's processed credits with reminders attached
  const baseCredits = creditsWithReminders || sourceCredits;

  // Use the filters hook for centralized filtering and sorting
  const {
    search,
    statusFilter,
    bulkList,
    sortBy,
    sortDir,
    filteredData: filteredCredits,
    sortedData: sortedCredits,
    isFiltered,
    setSearch,
    setStatusFilter,
    setBulkList,
    toggleSort,
  } = useFilters(baseCredits, getWorkflowState);

  const normalizedRole = (userRole || "read-only").toLowerCase();
  const roleLabel = ROLE_DISPLAY_NAMES[normalizedRole] || normalizedRole;
  const isReadOnly = normalizedRole === "read-only";
  const canEditRecords = normalizedRole === "owner" || normalizedRole === "credit";
  const availableTabs = useMemo(
    () => TAB_CONFIG.filter((tab) => tab.roles.includes(normalizedRole)),
    [normalizedRole]
  );
  const allowedTabKeys = availableTabs.map((tab) => tab.key);

  // Use centralized state management
  const {
    editMode,
    pendingEdits,
    editUpsert,
    editPushState,
    deleteState,
    selectedRowKeys,
    csvPushState,
    csvPushFile,
    csvPreview,
    reminderQueue,
    reminderFiredKeys,
    reminderDismissed,
    reminderSuppressUntil,
    alertsFilters,
    toggleEditMode,
    setPendingEdits,
    clearPendingEdits,
    setEditUpsert,
    setEditPushState,
    setDeleteState,
    toggleRowSelection,
    toggleAllSelection,
    clearSelection,
    setCsvFile,
    setCsvPushState,
    setCsvPreview,
    clearCsvData,
    setReminderQueue,
    addReminderNotifications,
    dismissReminderGroup,
    clearAllReminders,
    suppressReminders,
    setReminderFiredKeys,
    setReminderDismissed,
    setAlertsFilters,
  } = useAppState();

  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | edit | ic | kpis | risk | ai_intake
  useEffect(() => {
    if (allowedTabKeys.length && !allowedTabKeys.includes(activeTab)) {
      setActiveTab(allowedTabKeys[0]);
    }
  }, [allowedTabKeys, activeTab]);

  // Computed values from centralized state
  const groupedReminderRows = useMemo(() => {
    const map = new Map();
    reminderQueue.forEach((item) => {
      const ticket = item.ticket || "Unknown";
      const bucket = map.get(ticket) || [];
      bucket.push(item);
      map.set(ticket, bucket);
    });
    return Array.from(map.entries()).map(([ticket, items]) => ({
      ticket,
      message: items[0]?.message || "",
      keys: items.map((i) => i.key),
    }));
  }, [reminderQueue]);

  const selectedCount = selectedRowKeys.size;
  const hasCsvReady = csvPreview.parsed && csvPreview.rows.length > 0 && csvPreview.issues.length === 0;
  const defaultAlertsFilters = {
    search: "",
    bulk: "",
    action: "all",
    slaBucket: "all",
  };



  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(50);

  // Drawer
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  // Force dark mode by clearing any persisted light-mode selection
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light");
    try {
      localStorage.removeItem("cic-theme");
    } catch (err) {
      console.error("Failed to clear cic-theme from localStorage:", err);
    }
  }, []);

  // Defer analytics + heavy client logging until after first paint
  useEffect(() => {
    const activate = () => setAnalyticsReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(activate, { timeout: 1200 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }
    const t = setTimeout(activate, 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    logClientEvent({ level: "info", message: "CIC mounted", meta: { firebaseEnv } });
  }, [logClientEvent]);

  const handleEditPush = async () => {
    // include all filtered/sorted records so off-screen edits are not dropped
    const entries = sortedCredits
      .map((rec, idx) => {
        const key = getRecordKey(rec, idx);
        const edits = pendingEdits[key];
        if (!edits) return null;
        const merged = { ...rec, ...edits };
        const combo_key =
          (merged["Invoice Number"] && merged["Item Number"])
            ? `${merged["Invoice Number"]}|${merged["Item Number"]}`
            : null;
        return {
          ...merged,
          combo_key,
          id: rec.id || merged.id || undefined,
        };
      })
      .filter(Boolean);

    if (!entries.length) {
      setEditPushState({ loading: false, message: "", error: "No pending edits to push." });
      setTimeout(
        () =>
          setEditPushState((prev) =>
            prev.loading ? prev : { loading: false, message: "", error: "" }
          ),
        2000
      );
      return;
    }

    setEditPushState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch(`${API_BASE}/ingestion/ai-intake/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: entries.map(({ __firebase_duplicate, ...rest }) => {
            void __firebase_duplicate;
            return rest;
          }),
          mode: editUpsert ? "upsert" : "insert",
          upsert: editUpsert,
          db_url: currentDbUrl,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "Push failed"}`);
      }
      const data = await res.json();

      // Client-side fallback upsert to RTDB so edits appear immediately
      if (db) {
        for (const entry of entries) {
          const { id: entryId, combo_key, ...rest } = entry;
          const payload = { ...rest };
          // ensure combo_key is stored for future upserts
          if (combo_key) payload.combo_key = combo_key;

          if (entryId) {
            await update(ref(db, `credit_requests/${entryId}`), payload).catch((err) =>
              console.error("RTDB update failed (id):", err)
            );
          } else if (combo_key) {
            try {
              const snap = await get(
                query(ref(db, "credit_requests"), orderByChild("combo_key"), equalTo(combo_key))
              );
              if (snap.exists()) {
                const firstKey = Object.keys(snap.val())[0];
                await update(ref(db, `credit_requests/${firstKey}`), payload);
              } else {
                const newRef = push(ref(db, "credit_requests"));
                await set(newRef, { ...payload, id: newRef.key });
              }
            } catch (err) {
              console.error("RTDB upsert via combo_key failed:", err);
            }
          }
        }
      }

      setEditPushState({
        loading: false,
        message: data.details ? data.details.join(" | ") : "Push completed",
        error: "",
      });
      // clear local pending edits after success
      clearPendingEdits();
      clearSelection();
      setTimeout(
        () =>
          setEditPushState((prev) =>
            prev.loading ? prev : { loading: false, message: "", error: "" }
          ),
        4000
      );
    } catch (e) {
      setEditPushState({
        loading: false,
        message: "",
        error: e.message || "Push failed",
      });
    }
  };

  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const parseLine = (line) => {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).filter(Boolean).map((ln) => {
      const cells = parseLine(ln);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cells[idx] ?? "";
      });
      return obj;
    });
  };

  const handleCsvPreview = async () => {
    if (!csvPushFile) {
      setCsvPushState({ loading: false, message: "", error: "Select a CSV file first.", progress: null });
      setTimeout(
        () =>
          setCsvPushState((prev) =>
            prev.loading ? prev : { loading: false, message: "", error: "", progress: null }
          ),
        2000
      );
      return;
    }
    setCsvPushState({
      loading: true,
      message: "Reading CSV file...",
      error: "",
      progress: { step: 1, total: 4, label: "Parsing CSV data" }
    });

    try {
      // Step 1: Parse CSV text
      setCsvPushState(prev => ({ ...prev, message: "Parsing CSV data...", progress: { ...prev.progress, step: 1, label: "Parsing CSV data" } }));
      const text = await csvPushFile.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        throw new Error("CSV is empty or could not be parsed.");
      }

      // Step 2: Validate columns and data integrity
      setCsvPushState(prev => ({ ...prev, message: "Validating data structure...", progress: { ...prev.progress, step: 2, label: "Validating data structure" } }));
      const issues = [];

      rows.forEach((row, idx) => {
        const rowIdx = idx + 2; // header is line 1
        // Required combo or id
        const inv = row["Invoice Number"];
        const item = row["Item Number"];
        const combo = row.combo_key || (inv && item ? `${inv}|${item}` : null);
        const id = row.id || row.Id || row.ID || null;
        if (!id && !combo) {
          issues.push(`Row ${rowIdx}: missing id and combo_key (Invoice+Item).`);
        }
        if (!inv || !item) {
          issues.push(`Row ${rowIdx}: Invoice or Item is missing.`);
        }
      });

      // Step 3: Compare with existing Firebase data
      setCsvPushState(prev => ({ ...prev, message: "Cross-referencing with database...", progress: { ...prev.progress, step: 3, label: "Cross-referencing with database" } }));
      const byId = new Map();
      const byCombo = new Map();
      baseCredits.forEach((r) => {
        if (r.id) byId.set(r.id, r);
        const ck = r.combo_key || (r["Invoice Number"] && r["Item Number"] ? `${r["Invoice Number"]}|${r["Item Number"]}` : null);
        if (ck) byCombo.set(ck, r);
      });
      let updates = 0;
      let inserts = 0;
      const diffEntries = [];
      const comboSeen = new Set();
      rows.forEach((row, idx) => {
        const inv = row["Invoice Number"];
        const item = row["Item Number"];
        const combo = row.combo_key || (inv && item ? `${inv}|${item}` : null);
        const id = row.id || row.Id || row.ID || null;
        if (combo) {
          if (comboSeen.has(combo)) {
            issues.push(`Row ${idx + 2}: duplicate combo_key ${combo} in CSV.`);
          } else {
            comboSeen.add(combo);
          }
        }
        const match = (id && byId.get(id)) || (combo && byCombo.get(combo));
        if (match) {
          updates += 1;
          const changed = {};
          [
            "Customer Number",
            "Invoice Number",
            "Item Number",
            "QTY",
            "Credit Type",
            "Ticket Number",
            "RTN_CR_No",
            "Sales Rep",
            "Credit Request Total",
          ].forEach((field) => {
            const currentVal = match[field];
            const newVal = row[field];
            const bothEmpty =
              (currentVal === undefined || currentVal === "" || currentVal === null) &&
              (newVal === undefined || newVal === "" || newVal === null);
            if (!bothEmpty && String(currentVal ?? "") !== String(newVal ?? "")) {
              changed[field] = { from: currentVal, to: newVal };
            }
          });
          if (Object.keys(changed).length) {
            diffEntries.push({
              id: match.id || id || "",
              combo: combo || "",
              changed,
            });
          }
        } else {
          inserts += 1;
          issues.push(
            `Row ${idx + 2}: combo_key/id not found in Firebase. CSV round-trip can only update existing records (no new inserts).`
          );
        }
      });

      // Step 4: Generate summary
      setCsvPushState(prev => ({ ...prev, message: "Generating validation summary...", progress: { ...prev.progress, step: 4, label: "Generating validation summary" } }));

      setCsvPreview({
        parsed: true,
        rows,
        issues,
        summary: { updates, inserts, total: rows.length },
        diffEntries,
      });

      const statusMessage = issues.length === 0
        ? `Preview complete: ${updates} updates ready, ${rows.length} rows validated successfully.`
        : `Preview loaded with ${issues.length} issue${issues.length === 1 ? '' : 's'} found. ${updates} update${updates === 1 ? '' : 's'} ready.`;

      setCsvPushState({
        loading: false,
        message: statusMessage,
        error: "",
        progress: null,
      });
    } catch (e) {
      setCsvPushState({
        loading: false,
        message: "",
        error: e.message || "CSV preview failed - please check file format",
        progress: null
      });
      setCsvPreview({ parsed: false, rows: [], issues: [], summary: null });
    }
  };

  const handleDeleteSelected = async () => {
    const recordsToDelete = sortedCredits
      .map((rec, idx) => ({ rec, key: getRecordKey(rec, idx) }))
      .filter(({ key }) => selectedRowKeys.has(key));

    if (!recordsToDelete.length) {
      setDeleteState({ loading: false, message: "", error: "No rows selected." });
      return;
    }
    if (!db) {
      setDeleteState({ loading: false, message: "", error: "No Firebase connection for deletion." });
      return;
    }

    setDeleteState({ loading: true, message: "", error: "" });
    try {
      for (const { rec } of recordsToDelete) {
        const entryId = rec.id || rec.Id || rec.ID;
        const combo =
          rec.combo_key ||
          (rec["Invoice Number"] && rec["Item Number"]
            ? `${rec["Invoice Number"]}|${rec["Item Number"]}`
            : null);

        if (entryId) {
          await remove(ref(db, `credit_requests/${entryId}`));
        } else if (combo) {
          const snap = await get(
            query(ref(db, "credit_requests"), orderByChild("combo_key"), equalTo(combo))
          );
          if (snap.exists()) {
            const val = snap.val() || {};
            await Promise.all(Object.keys(val).map((k) => remove(ref(db, `credit_requests/${k}`))));
          }
        }
      }

      setLiveCredits((prev) =>
        prev.filter((r) => {
          const entryId = r.id || r.Id || r.ID;
          const combo =
            r.combo_key ||
            (r["Invoice Number"] && r["Item Number"]
              ? `${r["Invoice Number"]}|${r["Item Number"]}`
              : null);
          const shouldRemove = recordsToDelete.some(({ rec }) => {
            const delId = rec.id || rec.Id || rec.ID;
            const delCombo =
              rec.combo_key ||
              (rec["Invoice Number"] && rec["Item Number"]
                ? `${rec["Invoice Number"]}|${rec["Item Number"]}`
                : null);
            if (delId && entryId) return delId === entryId;
            if (delCombo && combo) return delCombo === combo;
            return false;
          });
          return !shouldRemove;
        })
      );

      setSelectedRowKeys(new Set());
      setDeleteState({
        loading: false,
        message: `Deleted ${recordsToDelete.length} row(s).`,
        error: "",
      });
      setTimeout(
        () =>
          setDeleteState((prev) =>
            prev.loading ? prev : { loading: false, message: "", error: "" }
          ),
        3000
      );
    } catch (e) {
      setDeleteState({
        loading: false,
        message: "",
        error: e.message || "Delete failed",
      });
    }
  };

  const handleClearPendingEdits = () => {
    clearPendingEdits();
    clearCsvData();
  };

  const handleCsvPush = async () => {
    if (!csvPushFile) {
      setCsvPushState({ loading: false, message: "", error: "Select a CSV file first." });
      return;
    }
    if (csvPreview.issues.length) {
      setCsvPushState({ loading: false, message: "", error: "Resolve CSV issues before pushing." });
      return;
    }
    const rows = csvPreview.parsed ? csvPreview.rows : [];
    if (!rows.length) {
      setCsvPushState({ loading: false, message: "", error: "Preview the CSV first." });
      return;
    }
    setCsvPushState({ loading: true, message: "", error: "" });
    const rowsWithKeys = rows.map((r) => {
      const inv = r["Invoice Number"];
      const item = r["Item Number"];
      const combo_key = r.combo_key || (inv && item ? `${inv}|${item}` : undefined);
      const base = combo_key ? { ...r, combo_key } : r;
      return base;
    });
    const hasKeys = rowsWithKeys.some(
      (r) =>
        r.id ||
        r.Id ||
        r.ID ||
        r.combo_key ||
        (r["Invoice Number"] && r["Item Number"])
    );
    const useUpsert = editUpsert || hasKeys;

    try {
      const res = await fetch(`${API_BASE}/ingestion/ai-intake/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsWithKeys,
          mode: useUpsert ? "upsert" : "insert",
          upsert: useUpsert,
          db_url: currentDbUrl,
        }),
      });
      if (!res.ok) {
        const textRes = await res.text();
        throw new Error(`HTTP ${res.status}: ${textRes || "Push failed"}`);
      }
      const data = await res.json();

      // client-side upsert fallback for CSV rows (id or combo_key or Invoice+Item)
      if (db) {
        // Build lookup maps once to avoid repeated RTDB reads
        let comboMap = new Map();
        let invItemMap = new Map();
        try {
          const allSnap = await get(ref(db, "credit_requests"));
          const val = allSnap.val() || {};
          Object.entries(val).forEach(([k, v]) => {
            if (v.combo_key) comboMap.set(v.combo_key, k);
            const inv = v["Invoice Number"];
            const item = v["Item Number"];
            if (inv && item) invItemMap.set(`${inv}|${item}`, k);
          });
        } catch (err) {
          console.error("RTDB fetch for upsert map failed:", err);
        }

        for (const entry of rowsWithKeys) {
          const entryId = entry.id || entry.Id || entry.ID;
          const combo_key =
            entry.combo_key ||
            (entry["Invoice Number"] && entry["Item Number"]
              ? `${entry["Invoice Number"]}|${entry["Item Number"]}`
              : null);
          const payload = { ...entry };
          if (combo_key) payload.combo_key = combo_key;

          const targetKey =
            entryId || (combo_key && comboMap.get(combo_key)) ||
            (combo_key && invItemMap.get(combo_key));

          if (targetKey) {
            await update(ref(db, `credit_requests/${targetKey}`), payload).catch((err) =>
              console.error("RTDB update failed (csv upsert):", err)
            );
          } else {
            const newRef = push(ref(db, "credit_requests"));
            await set(newRef, { ...payload, id: newRef.key });
          }
        }
      }

      setCsvPushState({
        loading: false,
        message:
          (useUpsert ? "[Upsert] " : "[Insert] ") +
          (data.details ? data.details.join(" | ") : "CSV push completed"),
        error: "",
      });
      setCsvFile(null);
      setCsvPreview({ parsed: false, rows: [], issues: [], summary: null });
      setTimeout(
        () =>
          setCsvPushState((prev) =>
            prev.loading ? prev : { loading: false, message: "", error: "" }
          ),
        4000
      );
    } catch (e) {
      setCsvPushState({
        loading: false,
        message: "",
        error: e.message || "CSV push failed",
      });
    }
  };

  const handleUnifiedPush = async () => {
    if (hasCsvReady) {
      await handleCsvPush();
    } else {
      await handleEditPush();
    }
  };



  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      const firedRaw = localStorage.getItem("reminderFiredKeys");
      const dismissedRaw = localStorage.getItem("reminderDismissed");
      if (firedRaw) {
        const parsed = JSON.parse(firedRaw);
        if (parsed.date === todayKey && Array.isArray(parsed.keys)) {
          setReminderFiredKeys(new Set(parsed.keys));
        }
      }
      if (dismissedRaw) {
        const parsed = JSON.parse(dismissedRaw);
        if (parsed.date === todayKey && Array.isArray(parsed.keys)) {
          setReminderDismissed(new Set(parsed.keys));
        }
      }
    } catch (err) {
      console.error("Failed to read reminder cache", err);
    }
  }, []);
  const hasDbConnection = Boolean(db);
  const isRemoteLoading = firebaseStatus === "loading" && liveCredits.length === 0;
  const showSummarySkeletons = isRemoteLoading || !analyticsReady;

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMs = now.getTime();
      if (reminderSuppressUntil && nowMs < reminderSuppressUntil) return;
    if (!baseCredits || !baseCredits.length) return;

      const todayKey = new Date().toISOString().slice(0, 10);

      const toAdd = [];
      for (const rec of baseCredits) {
        const reminder = rec.__reminder;
        if (!reminder) continue;
        if (!reminder.remind_day_before) continue;
        if (reminder.completed_at) continue;
        const key = getFirebaseReminderKey(reminder);
        if (!key || reminderFiredKeys.has(key) || reminderDismissed.has(key)) continue;
        const due = parseReminderDate(reminder);
        if (!due) continue;

        const timeStr = reminder.remind_time || "08:00";
        const [hh = "08", mm = "00"] = timeStr.split(":");
        const target = new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, Number(hh) || 8, Number(mm) || 0, 0);

        if (now >= target) {
          toAdd.push({
            key,
            ticket: rec["Ticket Number"] || "Unknown",
            invoice: rec["Invoice Number"] || "Unknown",
            message: `Follow-up for ticket ${rec["Ticket Number"] || "n/a"} is due tomorrow.`,
          });

          // Note: day_before_fired is no longer stored on credit records since reminders are centralized
        }
      }

      if (toAdd.length) {
        addReminderNotifications(toAdd, Array.from(reminderFiredKeys));
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [baseCredits, reminderDismissed, reminderFiredKeys, reminderSuppressUntil]);

  const normalizeAuthorTag = (user) => {
    if (!user) return "SYSTEM";
    const candidates = [];
    if (user.email) {
      const emailKey = user.email.toLowerCase().split("@")[0];
      candidates.push(emailKey);
    }
    if (user.displayName) {
      candidates.push(user.displayName.toLowerCase().replace(/\s+/g, ""));
    }
    if (user.uid) {
      candidates.push(user.uid.toLowerCase());
    }
    for (const candidate of candidates) {
      const cleanKey = candidate.replace(/[^a-z0-9]/g, "");
      if (cleanKey && AUTHOR_ALIAS_MAP[cleanKey]) {
        return AUTHOR_ALIAS_MAP[cleanKey];
      }
    }
    const raw = user.email || user.displayName || user.uid || "user";
    const fallback = raw.split(/[@\s]/)[0];
    return fallback.toUpperCase().replace(/[^A-Z0-9]/g, "") || "USER";
  };

  const handleAddStatusUpdate = useCallback(
    async (rec, note, applyAll) => {
      if (!note || !note.trim()) return;
      const stamp = getIndyTimestamp();
      const authorTag = normalizeAuthorTag(authUser);
      const line = `[${stamp}] [${authorTag}] ${note.trim()}`;
      const ticket = rec?.["Ticket Number"];

      setLiveCredits((prev) => {
        return prev.map((r) => {
          const match = applyAll && ticket ? r["Ticket Number"] === ticket : r.id === rec.id;
          if (!match) return r;
          const statusStr = r.Status ? `${r.Status}\n${line}` : line;
          return { ...r, Status: statusStr };
        });
      });

      // update selected record in drawer for immediate UI feedback
      setSelectedRecord((prev) => {
        if (!prev) return prev;
        const match = applyAll && ticket ? prev["Ticket Number"] === ticket : prev.id === rec.id;
        if (!match) return prev;
        const statusStr = prev.Status ? `${prev.Status}\n${line}` : line;
        return { ...prev, Status: statusStr };
      });

      // Persist to Firebase if available
      if (db) {
        const targets =
          applyAll && ticket
            ? liveCredits.filter((r) => r["Ticket Number"] === ticket && r.id)
            : rec?.id
            ? [rec]
            : [];

        for (const t of targets) {
          const statusStr = t.Status ? `${t.Status}\n${line}` : line;
          update(ref(db, `credit_requests/${t.id}`), { Status: statusStr }).catch((err) =>
            console.error("Failed to update status timeline:", err)
          );
        }
      }
    },
    [authUser, liveCredits, setLiveCredits, setSelectedRecord]
  );

  const persistReminderPaths = useCallback(
    async (items) => {
      if (!db || !items?.length) return;
      const rootRef = ref(db);
      const updates = {};
      items.forEach(({ path, payload }) => {
        updates[path] = payload;
      });
      try {
        await update(rootRef, updates);
      } catch (err) {
        console.error("Failed to persist reminder update:", err);
      }
    },
    []
  );

  const handleAlertReminderSaved = useCallback(
    async (firebaseKey, payload, rec) => {
      if (!firebaseKey || !payload) return;
      const normalized = { ...payload, firebaseKey };
      cacheReminderSafe(firebaseKey, normalized);

      // Update UI immediately with the new reminder
      if (rec) {
        setLiveCredits((prev) =>
          (prev || []).map((candidate) =>
            isSameCreditRecord(rec, candidate)
              ? { ...candidate, __reminder: normalized, __actionKey: firebaseKey }
              : candidate
          )
        );
        setSelectedRecord((prev) =>
          prev && isSameCreditRecord(rec, prev)
            ? { ...prev, __reminder: normalized, __actionKey: firebaseKey }
            : prev
        );
      }

      // Store reminder in centralized location only
      if (db) {
        await persistReminderPaths([
          { path: `reminders/${firebaseKey}`, payload: normalized }
        ]);
        console.log(`✅ Reminders: Saved reminder ${firebaseKey} to centralized storage`);
      }
    },
    [cacheReminderSafe, persistReminderPaths, setLiveCredits, setSelectedRecord]
  );

  const handleCompleteReminder = useCallback(
    async (rec) => {
      const reminder = rec?.__reminder;
      if (!reminder) return;

      const firebaseKey = getFirebaseReminderKey(reminder);
      if (!firebaseKey) {
        console.warn("Complete aborted: missing firebaseKey", reminder);
        return;
      }

      const recId = rec?.id;
      if (!recId) return;

      const updatedReminder = {
        ...reminder,
        status: "completed",
        completed_at: getIndyTimestamp(),
        firebaseKey,
      };

      setLiveCredits((prev) =>
        (prev || []).map((r) => (r?.id === recId ? { ...r, __reminder: updatedReminder } : r))
      );
      setSelectedRecord((prev) =>
        prev?.id === recId ? { ...prev, __reminder: updatedReminder } : prev
      );

      if (db) {
        await persistReminderPaths([
          { path: `reminders/${firebaseKey}`, payload: updatedReminder }
        ]);
        console.log(`✅ Reminders: Completed reminder ${firebaseKey}`);
      }

      cacheReminderSafe(firebaseKey, updatedReminder);
    },
    [persistReminderPaths, cacheReminderSafe, setLiveCredits, setSelectedRecord]
  );

  const handleSnoozeReminder = useCallback(
    async (rec, targetIso) => {
      const reminder = rec?.__reminder;
      if (!reminder) return;

      const recId = rec?.id || rec?.combo_key || rec?.key;
      if (!recId) {
        console.warn("Snooze aborted: missing rec.id/combo_key/key", { rec });
        return;
      }

      const firebaseKey = getFirebaseReminderKey(reminder);
      if (!firebaseKey) {
        console.warn("Snooze aborted: missing reminder.firebaseKey (RTDB key).", { reminder, rec });
        return;
      }

      const iso = targetIso || null;

      const updatedReminder = {
        ...reminder,
        snoozed_until: iso,
        status: iso ? "snoozed" : "pending",
        firebaseKey,
      };

      setLiveCredits((prev) =>
        (prev || []).map((r) => {
          const rId = r?.id || r?.combo_key || r?.key;
          return rId === recId ? { ...r, __reminder: updatedReminder } : r;
        })
      );

      setSelectedRecord((prev) => {
        if (!prev) return prev;
        const pId = prev?.id || prev?.combo_key || prev?.key;
        return pId === recId ? { ...prev, __reminder: updatedReminder } : prev;
      });

      if (db) {
        await persistReminderPaths([
          { path: `reminders/${firebaseKey}`, payload: updatedReminder }
        ]);
        console.log(`✅ Reminders: Snoozed reminder ${firebaseKey} to ${iso || 'unsnoozed'}`);
      }

      cacheReminderSafe(firebaseKey, updatedReminder);
    },
    [persistReminderPaths, cacheReminderSafe, setLiveCredits, setSelectedRecord]
  );

  const prevRemindersRef = useRef({});
  useEffect(() => {
    const prevKeys = Object.keys(prevRemindersRef.current || {});
    const currentKeys = Object.keys(remindersMapByKey);
    const removed = prevKeys.filter((key) => !currentKeys.includes(key));
    if (removed.length) {
      console.log(`🔄 Reminders: ${removed.length} reminders were removed from Firebase, cleaning up UI state`);
      // Since we no longer store reminders on credit records, we just need to update the UI
      // The credit records will automatically get updated when baseCredits recalculates
      setLiveCredits((prev) =>
        (prev || []).map((rec) => {
          const reminderKey = rec.__actionKey;
          if (reminderKey && removed.includes(reminderKey)) {
            const cleaned = { ...rec };
            delete cleaned.__reminder;
            delete cleaned.__actionKey;
            return cleaned;
          }
          return rec;
        })
      );
      setSelectedRecord((prev) => {
        if (!prev) return prev;
        const reminderKey = prev.__actionKey;
        if (reminderKey && removed.includes(reminderKey)) {
          const cleaned = { ...prev };
          delete cleaned.__reminder;
          delete cleaned.__actionKey;
          return cleaned;
        }
        return prev;
      });
    }
    prevRemindersRef.current = remindersMapByKey;
  }, [remindersMapByKey, setLiveCredits, setSelectedRecord]);

  // Create reminder records directly from Firebase reminders data
  const reminderRecords = useMemo(() => {
    if (!remindersLoaded) {
      console.log('🔄 Reminders: Not loaded yet, returning empty array');
      return [];
    }

    const records = Object.values(remindersMapByKey).map((reminder) => ({
      // Map reminder fields to display fields
      id: reminder.alert_id || reminder.id,
      firebaseKey: reminder.firebaseKey,
      "Customer Number": reminder.customer_number || "",
      "Invoice Number": reminder.invoice_number || "",
      "Item Number": reminder.item_number || "",
      "Ticket Number": reminder.ticket_number || "",
      "Sales Rep": "—", // Not available in reminders
      "Credit Request Total": "—", // Not available in reminders
      Date: reminder.created_at ? new Date(reminder.created_at).toISOString().split('T')[0] : "",
      combo_key: reminder.combo_key,
      // Include the reminder data
      __reminder: reminder,
      __actionKey: reminder.firebaseKey,
      // Mark as reminder-based record
      __isReminderRecord: true
    }));

    console.log(`✅ Reminders: Created ${records.length} reminder records for display`);
    return records;
  }, [remindersMapByKey, remindersLoaded]);

  // Alerts view: last 90 days without RTN/CR number, sorted oldest -> newest
  const alertsFollowUps = useMemo(() => {
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const cutoff = now - ninetyDaysMs;

    const pending = [];

    for (const rec of baseCredits) {
      const rawDate = rec.Date;
      if (!rawDate) continue;
      const d = new Date(rawDate);
      const t = d.getTime();
      if (Number.isNaN(t)) continue;
      if (t < cutoff) continue; // only last 90 days

      const hasRTN =
        rec.RTN_CR_No && rec.RTN_CR_No !== "nan" && rec.RTN_CR_No !== "";
      if (hasRTN) continue;

      // Add reminder data if available
      const ticketKey = getStrictReminderTicketKey(rec);
      const reminderKey = ticketKey ? reminderKeyByTicket[ticketKey] : null;
      const reminder = reminderKey ? remindersMapByKey[reminderKey] : null;

      pending.push({
        ...rec,
        __ts: t,
        ...(reminder && { __reminder: reminder, __actionKey: reminderKey })
      });
    }

    pending.sort((a, b) => a.__ts - b.__ts); // oldest first
    return pending.map(({ __ts, ...rest }) => {
      void __ts;
      return rest;
    });
  }, [baseCredits, remindersMapByKey, reminderKeyByTicket]);

  // Combine reminders and credit alerts for display
  const combinedAlerts = useMemo(() => {
    return [...reminderRecords, ...alertsFollowUps];
  }, [reminderRecords, alertsFollowUps]);

  // Filter combined alerts for display
  const filteredAlerts = useMemo(() => {
    const { search, bulk } = alertsFilters;
    const term = search.trim().toLowerCase();
    const bulkSet = parseBulkList(bulk);

    return combinedAlerts.filter((rec) => {
      if (term) {
        const haystack = [
          rec["Invoice Number"],
          rec["Item Number"],
          rec["Ticket Number"],
          rec["Customer Number"],
          rec.RTN_CR_No,
          rec["Reason for Credit"],
          rec["Credit Type"],
          rec["Sales Rep"],
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .join(" ");
        if (!haystack.includes(term)) return false;
      }

      if (bulkSet.size) {
        const inv = normalizeKey(rec["Invoice Number"]);
        const itm = normalizeKey(rec["Item Number"]);
        const tkt = normalizeKey(rec["Ticket Number"]);
        const bulkMatch = bulkSet.has(inv) || bulkSet.has(itm) || bulkSet.has(tkt);
        if (!bulkMatch) return false;
      }
      return true;
    });
  }, [combinedAlerts, alertsFilters]);

  // ======================
  // Duplicate detection (Invoice + Item pair)
  // ======================
  const duplicateStats = useMemo(() => {
    const pairFreq = new Map(); // key = "invoice|item"

    for (const rec of baseCredits) {
      const invoice = String(rec["Invoice Number"] ?? "").trim();
      const item = String(rec["Item Number"] ?? "").trim();

      if (!invoice || !item) continue;

      const key = `${invoice}|${item}`;
      pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
    }

    let duplicateRowCount = 0;
    let duplicatePairCount = 0;
    const duplicateCombos = new Set();

    pairFreq.forEach((count, key) => {
      if (count > 1) {
        duplicatePairCount += 1; // how many unique invoice+item combos duplicated
        duplicateRowCount += count; // total rows involved
        duplicateCombos.add(key);
      }
    });

    return {
      duplicateRowCount,
      duplicatePairCount,
      duplicateCombos,
    };
  }, [baseCredits]);



  // Reset visibleCount when filters or sorting change
  useEffect(() => {
    setVisibleCount(50);
  }, [search, statusFilter, sortBy, sortDir, baseCredits.length]);

  const totalRecords = sortedCredits.length;
  const visibleRecords = sortedCredits.slice(0, visibleCount);
  const topCredits = useMemo(() => sortedCredits.slice(0, 10), [sortedCredits]);

  const handleSelectAll = useCallback(
    (checked) => {
      toggleAllSelection(checked, visibleRecords, getRecordKey);
    },
    [toggleAllSelection, visibleRecords, getRecordKey]
  );

  const handleSelectRow = useCallback((key, checked) => {
    toggleRowSelection(key, checked);
  }, [toggleRowSelection]);

  const handleEditField = useCallback((key, field, value) => {
    setPendingEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  }, []);

  // ======================
  // Summary metrics
  // ======================
  const summary = useMemo(() => {
    const total = baseCredits.reduce(
      (sum, r) => sum + toNumber(r["Credit Request Total"]),
      0
    );
    const count = baseCredits.length;
    const avg = count ? total / count : 0;
    const pending = baseCredits.filter(
      (r) => getWorkflowState(r) === "Pending"
    ).length;

    return { total, count, avg, pending };
  }, [baseCredits]);

  const filteredSummary = useMemo(() => {
    const total = filteredCredits.reduce(
      (sum, r) => sum + toNumber(r["Credit Request Total"]),
      0
    );
    const count = filteredCredits.length;
    const avg = count ? total / count : 0;
    const pending = filteredCredits.filter(
      (r) => getWorkflowState(r) === "Pending"
    ).length;

    return { total, count, avg, pending };
  }, [filteredCredits]);


  // Risk inputs on current filtered set
  const riskSlaBuckets = useMemo(() => {
    const buckets = {
      "<30d": { count: 0, total: 0 },
      "30-59d": { count: 0, total: 0 },
      "60d+": { count: 0, total: 0 },
      "n/a": { count: 0, total: 0 },
    };
    for (const rec of filteredCredits) {
      if (getWorkflowState(rec) !== "Pending") continue;
      const { daysSinceCreated } = computeAging(rec);
      const badge = getSlaBadge(daysSinceCreated);
      const bucket = buckets[badge.label] || buckets["n/a"];
      bucket.count += 1;
      bucket.total += toNumber(rec["Credit Request Total"]);
    }
    return buckets;
  }, [filteredCredits]);

  const riskHighDollarTickets = useMemo(() => {
    const ticketTotals = new Map();
    for (const rec of filteredCredits) {
      const amt = toNumber(rec["Credit Request Total"]);
      if (amt <= 2500) continue;
      const ticket = String(rec["Ticket Number"] || "").trim() || "Unknown";
      ticketTotals.set(ticket, (ticketTotals.get(ticket) || 0) + amt);
    }
    return Array.from(ticketTotals.entries()).filter(([, total]) => total > 2500);
  }, [filteredCredits]);

  const riskHighDollarTotal = useMemo(
    () => riskHighDollarTickets.reduce((sum, [, total]) => sum + toNumber(total), 0),
    [riskHighDollarTickets]
  );

  const riskPendingTrend = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const currentStart = now - 7 * dayMs;
    const prevStart = currentStart - 7 * dayMs;
    let current = 0;
    let previous = 0;

    for (const rec of filteredCredits) {
      if (getWorkflowState(rec) !== "Pending") continue;
      const t = new Date(rec.Date || "").getTime();
      if (Number.isNaN(t)) continue;
      if (t >= currentStart) current += 1;
      else if (t >= prevStart) previous += 1;
    }

    const pctChange =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    return { current, previous, pctChange };
  }, [filteredCredits]);

  const riskIndex = useMemo(
    () =>
      computeRiskIndex({
        allSummary: summary,
        filteredSummary,
        slaBuckets: riskSlaBuckets,
        highDollarTickets: riskHighDollarTickets,
        highDollarTotal: riskHighDollarTotal,
        trendPct: riskPendingTrend.pctChange,
      }),
    [summary, filteredSummary, riskSlaBuckets, riskHighDollarTickets, riskHighDollarTotal, riskPendingTrend]
  );

  // Last 90d slice for KPIs
  const last90DaysCredits = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 90 * 24 * 60 * 60 * 1000;
    return baseCredits.filter((rec) => {
      const d = new Date(rec.Date);
      const t = d.getTime();
      if (Number.isNaN(t)) return false;
      return t >= cutoff;
    });
  }, [baseCredits]);

  // ======================
  // Analytics / charts
  // ======================
  const analytics = useMemo(() => {
    if (!analyticsReady) {
      return { volumeByDate: [], topReps: [], largestCredits: [], slaBuckets: [] };
    }
    // Volume by date
    const byDate = new Map();
    for (const rec of baseCredits) {
      const d = rec.Date || "";
      if (!d || d.toLowerCase() === "nan") continue;
      const current = byDate.get(d) || 0;
      byDate.set(d, current + toNumber(rec["Credit Request Total"]));
    }
    const volumeByDate = Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14); // last 14 days

    // Top reps by total
    const byRep = new Map();
    for (const rec of baseCredits) {
      const rep = rec["Sales Rep"] || "Unknown";
      byRep.set(rep, (byRep.get(rep) || 0) + toNumber(rec["Credit Request Total"]));
    }
    const topReps = Array.from(byRep.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top largest credits
    const largestCredits = [...baseCredits]
      .sort(
        (a, b) =>
          toNumber(b["Credit Request Total"]) -
          toNumber(a["Credit Request Total"])
      )
      .slice(0, 10);

    // SLA buckets (pending, last 90 days)
    const slaBucketsMap = {
      "<30d": 0,
      "30-59d": 0,
      "60d+": 0,
      "n/a": 0,
    };
    for (const rec of last90DaysCredits) {
      if (getWorkflowState(rec) !== "Pending") continue;
      const { daysSinceCreated } = computeAging(rec);
      const badge = getSlaBadge(daysSinceCreated);
      const key = badge?.label || "n/a";
      if (slaBucketsMap[key] === undefined) slaBucketsMap[key] = 0;
      slaBucketsMap[key] += 1;
    }
    const slaBuckets = Object.entries(slaBucketsMap);

    return { volumeByDate, topReps, largestCredits, slaBuckets };
  }, [analyticsReady, baseCredits, last90DaysCredits]);

  // ======================
  // Daily summary (simple heuristic)
  // ======================
  const dailySummary = useMemo(() => {
    if (!baseCredits.length) return "No credit data available yet.";

    const today = new Date();
    const yesterdayStr = dateOffsetString(today, -1);
    const dayBeforeStr = dateOffsetString(today, -2);

    let yCount = 0;
    let yTotal = 0;
    let prevPending = 0;
    let yPending = 0;

    for (const rec of baseCredits) {
      const d = rec.Date;
      const amt = toNumber(rec["Credit Request Total"]);
      const state = getWorkflowState(rec);

      if (d === yesterdayStr) {
        yCount += 1;
        yTotal += amt;
        if (state === "Pending") yPending += 1;
      }
      if (d === dayBeforeStr && state === "Pending") {
        prevPending += 1;
      }
    }

    const diffPending = yPending - prevPending;
    const direction =
      diffPending > 0 ? "increased" : diffPending < 0 ? "decreased" : "stayed flat";

    return `Yesterday (${yesterdayStr}) there were ${yCount.toLocaleString()} new credits for a total of ${formatCurrency(
      yTotal
    )}. Pending credits ${direction} by ${Math.abs(
      diffPending
    )} compared to the day before.`;
  }, [baseCredits]);

  // ======================
  // Infinite scroll handler
  // ======================
  const handleScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (
        el.scrollTop + el.clientHeight >= el.scrollHeight - 40 &&
        visibleCount < totalRecords
      ) {
        setVisibleCount((prev) => Math.min(prev + 50, totalRecords));
      }
    },
    [visibleCount, totalRecords]
  );



  // ======================
  // Export CSV
  // ======================
  const handleExportCSV = () => {
    const rows = sortedCredits;
    if (!rows.length) return;

    const headers = [
      "id",
      "combo_key",
      "Date",
      "Customer Number",
      "Invoice Number",
      "Item Number",
      "QTY",
      "Credit Type",
      "Ticket Number",
      "RTN_CR_No",
      "Sales Rep",
      "Credit Request Total",
    ];

    const csvLines = [headers.join(",")];

    for (const rec of rows) {
      const line = [
        rec.id || "",
        rec.combo_key || (rec["Invoice Number"] && rec["Item Number"] ? `${rec["Invoice Number"]}|${rec["Item Number"]}` : ""),
        rec.Date || "",
        rec["Customer Number"] || "",
        rec["Invoice Number"] || "",
        rec["Item Number"] || "",
        rec.QTY || "",
        rec["Credit Type"] || "",
        rec["Ticket Number"] || "",
        rec.RTN_CR_No || "",
        rec["Sales Rep"] || "",
        toNumber(rec["Credit Request Total"]),
      ]
        .map((val) => {
          const s = String(val ?? "");
          if (s.includes(",") || s.includes('"')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",");

      csvLines.push(line);
    }

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credits_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;

    const brandNavy = [15, 31, 74];
    const softGray = [245, 246, 248];
    const textDark = [32, 41, 52];

    const header = (text) => {
      doc.setFillColor(...brandNavy);
      doc.rect(0, 0, pageWidth, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text(text, 12, 14);
      doc.setFontSize(10);
      doc.text("TwinMed Credit Intelligence Center (CIC)", 12, 20);
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "normal");
      y = 30;
    };

    const section = (title) => {
      doc.setFillColor(...softGray);
      doc.rect(10, y, pageWidth - 20, 9, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, 12, y + 6.5);
      y += 15;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const keyVal = (label, value) => {
      doc.text(`${label}: ${value}`, 12, y);
      y += 6;
    };

    const divider = () => {
      doc.setDrawColor(230);
      doc.setLineWidth(0.2);
      doc.line(10, y, pageWidth - 10, y);
      y += 6;
    };

    const table = (rows, colDefs) => {
      const startY = y;
      const rowHeight = 8;
      // header
      doc.setFillColor(...softGray);
      doc.rect(10, y - 4, pageWidth - 20, rowHeight, "F");
      colDefs.reduce((x, col) => {
        doc.text(col.label, x + 2, y + rowHeight / 2 - 1);
        return x + col.width;
      }, 10);
      y += rowHeight + 2;
      rows.forEach((row, idx) => {
        let x = 10;
        if (idx % 2 === 0) {
          doc.setFillColor(247, 248, 250);
          doc.rect(10, y - rowHeight + 2, pageWidth - 20, rowHeight, "F");
        }
        colDefs.forEach((col) => {
          const text = col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
          doc.text(text, x + 2, y);
          x += col.width;
        });
        y += rowHeight;
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
      });
      y = Math.max(y, startY + rowHeight + 4);
    };

    header("Weekly Summary");

    section("Snapshot");
    const validDates = filteredCredits
      .map((r) => r.Date)
      .filter((d) => d && !Number.isNaN(new Date(d).getTime()))
      .sort();
    const dateRange =
      validDates.length > 1
        ? `${validDates[0]} to ${validDates[validDates.length - 1]}`
        : validDates.length === 1
        ? validDates[0]
        : "n/a";

    keyVal("Generated", new Date().toLocaleString());
    keyVal("Records (filtered)", filteredSummary.count);
    keyVal("Total Amount (filtered)", formatCurrency(filteredSummary.total));
    keyVal("Pending (filtered)", filteredSummary.pending);
    keyVal("Date Range (filtered)", dateRange);
    keyVal("Risk Index", `${riskIndex.label} (score ${riskIndex.score})`);
    y += 2;
    divider();

    section("SLA Breakdown (pending, last 90d)");
    const slaRows = Object.entries(riskSlaBuckets).map(([label, data]) => ({
      label,
      count: data.count,
      total: formatCurrency(data.total),
    }));
    if (slaRows.length) {
      table(slaRows, [
        { key: "label", label: "Bucket", width: 40 },
        { key: "count", label: "Count", width: 30 },
        { key: "total", label: "Total", width: 50 },
      ]);
    } else {
      keyVal("-", "No pending credits");
    }
    y += 4;

    section("Tickets > $2.5k (last 30d) - Need Jeff");
    const ticketRows = riskHighDollarTickets.slice(0, 12).map(([ticket, total]) => ({
      ticket,
      total: formatCurrency(total),
    }));
    if (ticketRows.length) {
      table(ticketRows, [
        { key: "ticket", label: "Ticket", width: 60 },
        { key: "total", label: "Total", width: 60 },
      ]);
    } else {
      keyVal("-", "None");
    }

    y += 4;
    section("Ticket Details (filtered)");
    const detailRows = filteredCredits.slice(0, 15).map((rec) => ({
      ticket: rec["Ticket Number"] || "-",
      account: rec["Customer Number"] || "-",
      rep: rec["Sales Rep"] || "-",
      cr: rec.RTN_CR_No && rec.RTN_CR_No !== "nan" ? rec.RTN_CR_No : "-",
      total: formatCurrency(rec["Credit Request Total"]),
    }));
    if (detailRows.length) {
      table(detailRows, [
        { key: "ticket", label: "Ticket", width: 36 },
        { key: "account", label: "Account", width: 36 },
        { key: "rep", label: "Sales Rep(s)", width: 44 },
        { key: "cr", label: "CR #", width: 30 },
        {
          key: "total",
          label: "Credit Total",
          width: pageWidth - 10 - 36 - 36 - 44 - 30 - 4,
        },
      ]);
    } else {
      keyVal("-", "No records in current filter");
    }

    doc.save("credit_summary.pdf");
  };

  // ======================
  // RENDER
  // ======================
  const statusLabel =
    firebaseStatus === "live"
      ? "Live data from Firebase Realtime Database"
      : firebaseStatus === "loading"
      ? "Loading from Firebase…"
      : firebaseStatus === "error"
      ? "Firebase error – showing mock data"
      : firebaseStatus === "mock"
      ? "Firebase not initialized – using local mock data"
      : "Using local mock data (no Firebase records yet).";

  const statusColor =
    firebaseStatus === "live"
      ? "#4ade80"
      : firebaseStatus === "loading"
      ? "#facc15"
      : firebaseStatus === "error"
      ? "#f97373"
      : "#9ca3af";

  const lastUpdatedLabel =
    lastLiveRefresh && firebaseStatus === "live"
      ? `Updated at ${lastLiveRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : firebaseStatus === "loading"
      ? "Awaiting first sync…"
      : firebaseStatus === "error"
      ? "Last sync failed"
      : "";

  // Error logging handler
  const handleGlobalError = useCallback((error, errorInfo, errorId) => {
    // Log to monitoring service
    console.error(`🚨 Error Boundary [${errorId}]:`, error, errorInfo);

    // Here you could send to error reporting services like:
    // - Sentry: Sentry.captureException(error, { contexts: { react: errorInfo } });
    // - LogRocket: LogRocket.captureException(error, { extra: errorInfo });
    // - Bugsnag: Bugsnag.notify(error, { metaData: errorInfo });

    // For now, just log to console with structured data
    logClientEvent({
      level: "error",
      message: `React Error Boundary: ${error.message}`,
      meta: {
        errorId,
        componentStack: errorInfo.componentStack,
        stack: error.stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }
    });
  }, [logClientEvent]);

  return (
    <ErrorBoundary onError={handleGlobalError}>
      <div className="neo-shell">
        {/* Header */}
        <ComponentErrorBoundary componentName="App Header">
          <AppHeader
            firebaseEnv={firebaseEnv}
            statusLabel={statusLabel}
            statusColor={statusColor}
            lastUpdatedLabel={lastUpdatedLabel}
            roleLabel={roleLabel}
            authEmail={authUser?.email || ""}
            onLogout={onLogout}
            availableTabs={availableTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </ComponentErrorBoundary>

        <main className="neo-main">
          {/* Reminders Section */}
          <ComponentErrorBoundary componentName="Reminders Section">
            {reminderQueue.length > 0 && (
              <div
                style={{
                  marginBottom: "0.6rem",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid rgba(96,165,250,0.35)",
                  background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(16,185,129,0.14))",
                  fontSize: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                  <span>
                    <strong>Reminders:</strong> {groupedReminderRows.length} due tomorrow
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setReminderQueue([])}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.2rem 0.65rem",
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const until = Date.now() + 60 * 60 * 1000;
                        suppressReminders(until);
                      }}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.2rem 0.65rem",
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Hide 1h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const end = new Date();
                        end.setHours(23, 59, 59, 999);
                        suppressReminders(end.getTime());
                      }}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: "0.2rem 0.65rem",
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Hide today
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {groupedReminderRows.map((group) => (
                    <div
                      key={group.ticket}
                      style={{
                        padding: "0.45rem 0.6rem",
                        borderRadius: "0.6rem",
                        background: "rgba(15,23,42,0.72)",
                        border: "1px solid rgba(148,163,184,0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span>
                        <strong>Ticket:</strong> {group.ticket} — {group.message}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          dismissReminderGroup(group.keys);
                        }}
                        style={{
                          borderRadius: "999px",
                          border: "1px solid rgba(148,163,184,0.5)",
                          padding: "0.2rem 0.65rem",
                          background: "rgba(15,23,42,0.9)",
                          color: "#e5e7eb",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ComponentErrorBoundary>

          <div className="main-scroll">
            {activeTab === "dashboard" && (
              <TabErrorBoundary tabName="Dashboard">
                <DashboardTab
                  search={search}
                  statusFilter={statusFilter}
                  bulkList={bulkList}
                  onSearchChange={setSearch}
                  onStatusFilterChange={setStatusFilter}
                  onBulkListChange={setBulkList}
                  onExportCsv={handleExportCSV}
                  onExportPdf={handleExportPDF}
                  totalRecords={totalRecords}
                  visibleRecords={visibleRecords}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  onScroll={handleScroll}
                  selectedRowKeys={selectedRowKeys}
                  onToggleSelectAll={handleSelectAll}
                  onToggleRow={handleSelectRow}
                  pendingEdits={pendingEdits}
                  onEditField={handleEditField}
                  summary={summary}
                  filteredSummary={filteredSummary}
                  isFiltered={isFiltered}
                  duplicateStats={duplicateStats}
                  dailySummary={dailySummary}
                  showSummarySkeletons={showSummarySkeletons}
                  riskIndex={riskIndex}
                  analyticsReady={analyticsReady}
                  analytics={analytics}
                  isRemoteLoading={isRemoteLoading}
                  getRecordKey={getRecordKey}
                  getWorkflowState={getWorkflowState}
                  extractLatestStatusLabel={extractLatestStatusLabel}
                  formatCurrency={formatCurrency}
                  salesRepOptions={SALES_REPS}
                  creditTypeOptions={CREDIT_TYPES}
                  onRowClick={(rec) => setSelectedRecord(rec)}
                  topCredits={topCredits}
                />
              </TabErrorBoundary>
            )}

            {activeTab === "edit" && (
              <TabErrorBoundary tabName="Edit Records">
                <EditRecordsTab
                  search={search}
                  statusFilter={statusFilter}
                  bulkList={bulkList}
                  onSearchChange={setSearch}
                  onStatusFilterChange={setStatusFilter}
                  onBulkListChange={setBulkList}
                  onExportCsv={handleExportCSV}
                  onExportPdf={handleExportPDF}
                  editMode={editMode}
                  onToggleEditMode={toggleEditMode}
                  pendingEdits={pendingEdits}
                  onClearPendingEdits={handleClearPendingEdits}
                  editUpsert={editUpsert}
                  onEditUpsertChange={setEditUpsert}
                  editPushState={editPushState}
                  deleteState={deleteState}
                  csvPushState={csvPushState}
                  csvPushFile={csvPushFile}
                  onCsvFileChange={setCsvFile}
                  onCsvPreview={handleCsvPreview}
                  csvPreview={csvPreview}
                  onDeleteSelected={handleDeleteSelected}
                  selectedCount={selectedCount}
                  hasDbConnection={hasDbConnection}
                  onUnifiedPush={handleUnifiedPush}
                  totalRecords={totalRecords}
                  visibleRecords={visibleRecords}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  onScroll={handleScroll}
                  selectedRowKeys={selectedRowKeys}
                  onToggleSelectAll={handleSelectAll}
                  onToggleRow={handleSelectRow}
                  onEditField={handleEditField}
                  getRecordKey={getRecordKey}
                  getWorkflowState={getWorkflowState}
                  extractLatestStatusLabel={extractLatestStatusLabel}
                  formatCurrency={formatCurrency}
                  duplicateStats={duplicateStats}
                  salesRepOptions={SALES_REPS}
                  creditTypeOptions={CREDIT_TYPES}
                  onRowClick={(rec) => setSelectedRecord(rec)}
                  canEditRecords={canEditRecords}
                />
              </TabErrorBoundary>
            )}

            {activeTab === "ic" && (
              <TabErrorBoundary tabName="Credit Aging Hub">
                <AlertsFollowUpsTab
                  alerts={combinedAlerts || []}
                  filters={alertsFilters}
                  defaultFilters={defaultAlertsFilters}
                  onFiltersChange={setAlertsFilters}
                  onSelect={(rec) => setSelectedRecord(rec)}
                  dbInstance={db}
                  textStyles={TEXT}
                  computeAging={computeAging}
                  toNumber={toNumber}
                  getSlaBadge={getSlaBadge}
                  formatCurrency={formatCurrency}
                  remindersMapByKey={remindersMapByKey}
                  reminderKeyByTicket={reminderKeyByTicket}
                  onReminderSaved={handleAlertReminderSaved}
                />
              </TabErrorBoundary>
            )}

            {activeTab === "kpis" && (
              <TabErrorBoundary tabName="KPIs">
                <KpisTab
                  analytics={analytics}
                  credits={last90DaysCredits}
                  formatCurrency={formatCurrency}
                  toNumber={toNumber}
                />
              </TabErrorBoundary>
            )}

            {activeTab === "risk" && (
              <TabErrorBoundary tabName="Risk Scores">
                <RiskScoresTab records={baseCredits} formatCurrency={formatCurrency} toNumber={toNumber} />
              </TabErrorBoundary>
            )}

            {activeTab === "ai_intake" && (
              <TabErrorBoundary tabName="AI Intake">
                <AiIntakeView theme={theme} firebaseEnv={firebaseEnv} currentDbUrl={currentDbUrl} sandboxCredJsonPath={sandboxCredJsonPath} />
              </TabErrorBoundary>
            )}
          </div>
        </main>

        {/* Drawer for details */}
        <ComponentErrorBoundary componentName="Detail Drawer">
          {selectedRecord && (
            <DetailDrawer
              rec={selectedRecord}
              onClose={() => setSelectedRecord(null)}
              onAddStatusUpdate={handleAddStatusUpdate}
              onCompleteReminder={handleCompleteReminder}
              onSnoozeReminder={handleSnoozeReminder}
              dbInstance={db}
              readOnly={isReadOnly}
            />
          )}
        </ComponentErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

// =======================
// UI components
// =======================

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState("read-only");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserRole("read-only");
        return;
      }

      let resolvedRole = "read-only";
      try {
        const tokenResult = await getIdTokenResult(user);
        const claimRole = tokenResult?.claims?.role;
        if (claimRole) {
          resolvedRole = String(claimRole).toLowerCase();
        }
      } catch (err) {
        console.error("Failed to read custom claims:", err);
      }

      if (resolvedRole === "read-only") {
        try {
          const snap = await get(ref(db, `user_roles/${user.uid}`));
          const val = snap.val();
          const fallbackRole =
            val?.role || val?.type || val?.access || val?.permission;
          if (fallbackRole) {
            resolvedRole = String(fallbackRole).toLowerCase();
          }
        } catch (err) {
          console.error("Failed to read role from DB:", err);
        }
      }

      setUserRole(resolvedRole || "read-only");
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth).catch((err) => console.error("Sign-out failed:", err));
  };

  if (authLoading) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <p style={{ color: "#e5e7eb" }}>Connecting to Firebase…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <Login
        onLogin={() => {
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/dashboard");
          }
        }}
      />
    );
  }

  return (
    <AuthenticatedApp userRole={userRole} authUser={authUser} onLogout={handleLogout} />
  );
}

// helper for dailySummary
function dateOffsetString(baseDate, offsetDays) {
  const d = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default App;
