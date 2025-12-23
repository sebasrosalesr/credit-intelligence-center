// src/components/tabs/AlertsFollowUpsTab.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ref, push } from "firebase/database";
import SlaPill from "../common/SlaPill.jsx";
import RepsVsCreditTotal from "../charts/RepsVsCreditTotal.jsx";
import { Th, Td } from "../common/TableCells.jsx";
import {
  reminderOverlayStyle,
  reminderPanelStyle,
  reminderPanelAccent,
  reminderPanelGlow,
  reminderGhostIconButton,
} from "../modalStyles.js";
import { getStrictReminderTicketKey, parseStatusTimeline } from "../../utils/recordHelpers";

/**
 * Credit Aging Hub tab (alerts/follow-ups).
 * Relies on helpers passed in from App to avoid duplicating shared logic.
 */
function AlertsFollowUpsTab({
  alerts = [],
  filters,
  defaultFilters,
  onFiltersChange,
  onSelect,
  dbInstance,
  textStyles,
  computeAging,
  toNumber,
  getSlaBadge,
  formatCurrency,
  remindersMapByKey = {},
  reminderKeyByTicket = {},
  onReminderSaved,
}) {
  // Check if we have mixed records (both reminders and credits)
  const hasReminderRecords = alerts.some(rec => rec.__isReminderRecord);
  const hasCreditRecords = alerts.some(rec => !rec.__isReminderRecord);
  const isMixedMode = hasReminderRecords && hasCreditRecords;
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortDir, setSortDir] = useState("asc"); // asc = oldest first, desc = newest first
  const preset = filters?.preset || "none";
  const isSystemPreset = preset === "latest_billing_sync";

  useEffect(() => {
    if (isSystemPreset) {
      setSortDir("desc");
    }
  }, [isSystemPreset]);

  const generateReminderKey = useCallback(() => {
    if (dbInstance) {
      return push(ref(dbInstance, "reminders")).key;
    }
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `reminder-temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }, [dbInstance]);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [reminderModal, setReminderModal] = useState({
    open: false,
    rec: null,
    actionKey: "",
    date: todayISO,
    time: "",
    note: "",
    priority: "normal",
    remindDayBefore: true,
    remindTime: "08:00",
  });
  const reminderDateRef = useRef(null);
  const handleScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40 && visibleCount < alerts.length) {
        setVisibleCount((prev) => Math.min(prev + 50, alerts.length));
      }
    },
    [visibleCount, alerts.length]
  );

  const sortedAlerts = useMemo(() => {
    const getSystemUpdateMs = (rec) => {
      const timeline = parseStatusTimeline(rec?.Status);
      if (!timeline.length) return -Infinity;
      const systemEntries = timeline.filter((entry) => (entry.label || "").includes("[SYSTEM]"));
      if (!systemEntries.length) return -Infinity;
      const latest = systemEntries[systemEntries.length - 1];
      const ts = latest?.timestamp;
      if (!ts) return -Infinity;
      const parsed = new Date(ts.replace(" ", "T")).getTime();
      return Number.isNaN(parsed) ? -Infinity : parsed;
    };

    const toMs = (rec) => {
      if (isSystemPreset) {
        const systemMs = getSystemUpdateMs(rec);
        if (systemMs !== -Infinity) return systemMs;
      }
      const t = new Date(rec.Date || "").getTime();
      return Number.isNaN(t) ? -Infinity : t;
    };
    const copy = [...alerts];
    copy.sort((a, b) => {
      const diff = toMs(a) - toMs(b);
      const effectiveDir = isSystemPreset ? "desc" : sortDir;
      return effectiveDir === "desc" ? -diff : diff;
    });
    return copy;
  }, [alerts, sortDir, isSystemPreset]);

  const matchesAction = useCallback(
    (actionState) => {
      const a = filters.action || "all";
      const status = (actionState?.status || "").toLowerCase();
      if (a === "all") return true;
      if (a === "pending") return status === "pending";
      if (a === "completed") return status === "completed" || status === "done";
      if (a === "snoozed") return status === "snoozed";
      if (a === "rush") return actionState?.priority === "rush" || actionState?.priority === "ultra_rush";
      return true;
    },
    [filters.action]
  );

  const visibleAlerts = useMemo(() => {
    // Handle mixed records: both reminders and credits
    const enriched = sortedAlerts.map((rec, idx) => {
      if (rec.__isReminderRecord) {
        // This is a reminder record - it already has __reminder and __actionKey
        return {
          rec,
          idx,
          actionKey: rec.__actionKey,
          actionState: rec.__reminder,
          originalIndex: idx
        };
      } else {
        // This is a credit record - need to match with reminders
        const ticketKey = getStrictReminderTicketKey(rec);
        const reminderKey = ticketKey ? reminderKeyByTicket[ticketKey] : null;
        const actionState = reminderKey ? remindersMapByKey[reminderKey] : null;
        const canonicalActionKey = reminderKey || null;
        return { rec, idx, actionKey: canonicalActionKey, actionState, originalIndex: idx };
      }
    });

    const filteredByAction =
      filters.action && filters.action !== "all"
        ? enriched.filter(({ actionState }) => matchesAction(actionState))
        : enriched;

    // Apply SLA filtering only to credit records (not reminder records)
    const filtered =
      filters.slaBucket && filters.slaBucket !== "all"
        ? filteredByAction.filter(({ rec }) => {
            // Skip SLA filtering for reminder records
            if (rec.__isReminderRecord) return true;

            const { daysPending } = computeAging(rec);
            if (daysPending == null) return false;
            if (filters.slaBucket === "lt30") return daysPending < 30;
            if (filters.slaBucket === "30_59") return daysPending >= 30 && daysPending < 60;
            if (filters.slaBucket === "60_plus") return daysPending >= 60;
            return true;
          })
        : filteredByAction;

    return filtered.slice(0, visibleCount);
  }, [
    sortedAlerts,
    visibleCount,
    filters.action,
    filters.slaBucket,
    matchesAction,
    computeAging,
    reminderKeyByTicket,
    remindersMapByKey,
  ]);

  const statsByRep = useMemo(() => {
    const map = new Map();
    for (const rec of alerts) {
      const rep = rec["Sales Rep"] || "Unknown";
      const item = rec["Item Number"];
      const customer = rec["Customer Number"];
      const entry = map.get(rep) || { total: 0, items: new Set(), customers: new Set() };
      entry.total += toNumber(rec["Credit Request Total"]);
      if (item) entry.items.add(item);
      if (customer) entry.customers.add(customer);
      map.set(rep, entry);
    }

    return Array.from(map.entries())
      .map(([rep, data]) => ({
        rep,
        total: data.total,
        items: data.items.size,
        accounts: data.customers.size,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [alerts, toNumber]);

  const getRowColor = (rec) => {
    const { daysPending } = computeAging(rec);
    if (daysPending == null) return "#020617";
    if (daysPending >= 60) return "rgba(248,113,113,0.15)";
    if (daysPending >= 30) return "rgba(234,179,8,0.12)";
    return "rgba(52,211,153,0.08)";
  };

  const slaSummary = useMemo(() => {
    const buckets = {
      lt30: 0,
      mid30_59: 0,
      gte60: 0,
    };
    for (const rec of alerts) {
      const { daysPending } = computeAging(rec);
      if (daysPending == null) continue;
      if (daysPending >= 60) buckets.gte60 += 1;
      else if (daysPending >= 30) buckets.mid30_59 += 1;
      else buckets.lt30 += 1;
    }
    return buckets;
  }, [alerts, computeAging]);

  return (
    <section>
      <div className="panel" style={{ marginBottom: "1rem", padding: "1rem 1.1rem" }} data-animate>
        <h2 style={{ margin: 0, ...textStyles.panelHeading, fontSize: "1rem", color: "#e9eefb" }}>
          🚩 Credit Aging Hub
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, ...textStyles.bodyMuted }}>
              Active follow-up reminders and credits from the last 90 days with no RTN/CR #.
            </p>
            <div style={{ ...textStyles.smallMuted }}>
              {alerts.length.toLocaleString()} items (reminders + credits) · Sorted{" "}
              {(isSystemPreset ? "newest → oldest (system updates)" : sortDir === "desc" ? "newest → oldest" : "oldest → newest")}.
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
              style={icPillButtonStyle}
              disabled={isSystemPreset}
            >
              Sort by date: {sortDir === "desc" ? "Newest -> Oldest" : "Oldest -> Newest"}
            </button>
            <button
              type="button"
              onClick={() => onFiltersChange({ ...defaultFilters, slaBucket: "all" })}
              style={icPillButtonStyle}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* SLA Filters row - only show for credit records, not reminders */}
      {hasCreditRecords && (
        <section
          className="panel panel-muted"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.9rem",
            marginBottom: "1rem",
            alignItems: "flex-start",
            padding: "1rem",
          }}
          data-animate="2"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.6rem",
            }}
          >
            <SummaryPill
              label="SLA < 30d"
              value={slaSummary.lt30}
              onClick={() =>
                onFiltersChange((prev) => ({
                  ...prev,
                  slaBucket: "lt30",
                }))
              }
            />
            <SummaryPill
              label="SLA 30-59d"
              value={slaSummary.mid30_59}
              onClick={() =>
                onFiltersChange((prev) => ({
                  ...prev,
                  slaBucket: "30_59",
                }))
              }
            />
            <SummaryPill
              label="SLA 60d+"
              value={slaSummary.gte60}
              onClick={() =>
                onFiltersChange((prev) => ({
                  ...prev,
                  slaBucket: "60_plus",
                }))
              }
            />
          </div>
        </section>
      )}

      <section className="panel panel-muted" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div className="filters-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            value={preset}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, preset: e.target.value }))}
            className="select"
            style={{ minWidth: 220 }}
          >
            <option value="none">Preset: None</option>
            <option value="latest_billing_sync">Preset: Latest Billing Sync</option>
          </select>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by invoice, item, ticket, customer, RTN, reason..."
            className="input"
            style={{ flex: "1 1 260px" }}
          />
          <select
            value={filters.action}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, action: e.target.value }))}
            className="select"
            style={{ minWidth: 160 }}
          >
            <option value="all">Status: All</option>
            <option value="pending">Status: Pending</option>
            <option value="completed">Status: Completed</option>
            <option value="snoozed">Status: Snoozed</option>
            <option value="rush">Status: Rush</option>
          </select>
          <textarea
            value={filters.bulk}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, bulk: e.target.value }))}
            rows={2}
            placeholder="Paste invoice/item/ticket list (comma, space, or newline separated)"
            className="textarea"
            style={{ flex: "1 1 260px", minWidth: "240px", resize: "vertical" }}
          />
        </div>
      </section>

      <section className="panel" style={{ padding: 0, overflow: "hidden" }} data-animate="3">
        <div className="panel-heading">
          <span style={{ ...textStyles.smallMuted }}>
            {alerts.length.toLocaleString()} items · showing {visibleAlerts.length.toLocaleString()}
          </span>
          <span style={{ ...textStyles.smallMuted }}>Infinite scroll</span>
        </div>
        <div style={{ maxHeight: "420px", overflowY: "auto" }} onScroll={handleScroll}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ background: "#020617" }}>
                <Th>Date</Th>
                <Th>Customer #</Th>
                <Th>Invoice #</Th>
                <Th>Item #</Th>
                <Th>Ticket #</Th>
                <Th>Sales Rep</Th>
                <Th>Credit Total</Th>
                <Th>Days Pending</Th>
                <Th>SLA</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {visibleAlerts.map(({ rec, idx, actionKey, actionState }) => {
                const isReminderRecord = rec.__isReminderRecord;
                const { daysPending } = isReminderRecord ? { daysPending: null } : computeAging(rec);
                const sla = isReminderRecord ? null : getSlaBadge(daysPending);
                const effectiveAction = actionState;
                const reminderStatus = getReminderVisualStatus(effectiveAction);
                const priorityStyle = getPriorityStyle(effectiveAction?.priority);
                const dueLabel =
                  effectiveAction?.due_date || effectiveAction?.due_time
                    ? `${effectiveAction.due_date || ""}${effectiveAction.due_time ? " " + effectiveAction.due_time : ""}`
                    : null;
                const reminderLabel = (() => {
                  if (!effectiveAction) return null;
                  if (effectiveAction.status === "completed") {
                    const ts = effectiveAction.completed_at || dueLabel;
                    return `completed${ts ? ` · ${ts}` : ""}`;
                  }
                  const statusText = priorityStyle?.label || effectiveAction.status || "pending";
                  return statusText + (dueLabel ? ` · ${dueLabel}` : "");
                })();

                return (
                  <tr
                    key={rec.id || `${rec["Invoice Number"]}-alert-${idx}`}
                    style={{
                      borderTop: "1px solid #111827",
                      background:
                        reminderStatus === "overdue"
                          ? "rgba(248,113,113,0.12)"
                          : reminderStatus === "due_today"
                          ? "rgba(250,204,21,0.12)"
                          : reminderStatus === "done"
                          ? "rgba(107,114,128,0.12)"
                          : isReminderRecord
                          ? "#020617" // neutral background for reminder records
                          : getRowColor(rec),
                      opacity: reminderStatus === "done" ? 0.75 : 1,
                      boxShadow: priorityStyle?.shadow || "none",
                      cursor: "pointer",
                    }}
                    onClick={() => onSelect({ ...rec, __reminder: effectiveAction, __actionKey: actionKey })}
                  >
                    <Td>{rec.Date || ""}</Td>
                    <Td>{rec["Customer Number"]}</Td>
                    <Td>{rec["Invoice Number"]}</Td>
                    <Td>{rec["Item Number"]}</Td>
                    <Td>{rec["Ticket Number"] || "—"}</Td>
                    <Td>{isReminderRecord ? "—" : (rec["Sales Rep"] || "—")}</Td>
                    <Td>{isReminderRecord ? "—" : formatCurrency(rec["Credit Request Total"])}</Td>
                    <Td>{isReminderRecord ? "—" : (daysPending != null ? daysPending : "n/a")}</Td>
                    <Td>
                      {isReminderRecord ? "—" : <SlaPill badge={sla} />}
                    </Td>
                    <Td style={{ whiteSpace: "normal" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const effectiveDue = effectiveAction?.due_date;
                            const safeDate =
                              effectiveDue && effectiveDue >= todayISO ? effectiveDue : todayISO;
                            const canonicalActionKey = actionKey || generateReminderKey();
                            setReminderModal({
                              open: true,
                              rec,
                              actionKey: canonicalActionKey,
                              date: safeDate,
                              time: reminderModal.time || "",
                              note: reminderModal.note || "",
                              priority: effectiveAction?.priority || "normal",
                              remindDayBefore: effectiveAction?.remind_day_before ?? true,
                              remindTime: effectiveAction?.remind_time || "08:00",
                            });
                          }}
                          style={quickActionStyle("#1f2937")}
                        >
                          Review
                        </button>
                        {reminderLabel && (
                          <span
                            style={{
                              color: priorityStyle?.color || "#9ca3af",
                              fontSize: "0.75rem",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "0.5rem",
                              border: "1px solid #1f2937",
                              background: priorityStyle?.bg || "transparent",
                              boxShadow: priorityStyle?.shadow || "none",
                            }}
                          >
                            {reminderLabel}
                          </span>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}

              {visibleAlerts.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No items match the current filters.
                  </td>
                </tr>
              )}
              {alerts.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No active follow-up reminders or credits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sales reps chart - only show for credit records, not reminders */}
      {hasCreditRecords && (
        <section style={{ marginTop: "1.25rem" }}>
          <RepsVsCreditTotal rows={statsByRep} formatCurrency={formatCurrency} />
        </section>
      )}

      {/* Reminder modal */}
      {reminderModal.open && (
        <div
          className="cic-modal-overlay"
          style={reminderOverlayStyle}
          onClick={() =>
            setReminderModal({
              open: false,
              rec: null,
              actionKey: "",
              date: todayISO,
              time: "",
              note: "",
              priority: "normal",
              remindDayBefore: true,
            })
          }
        >
          <div className="cic-modal-panel" style={reminderPanelStyle} onClick={(e) => e.stopPropagation()}>
            <div style={reminderPanelAccent} />
            <div style={reminderPanelGlow} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                className="cic-modal-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div>
                  <h3 className="cic-modal-title" style={{ margin: 0, fontSize: "1rem", color: "#e5e7eb", fontWeight: 600 }}>
                    Add Follow-up Reminder
                  </h3>
                  <div className="cic-modal-subtitle" style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: 4 }}>
                    {reminderModal.rec?.["Invoice Number"]} · {reminderModal.rec?.["Item Number"]}
                  </div>
                </div>
                <button
                  type="button"
                  className="cic-close-btn"
                  onClick={() =>
                    setReminderModal({
                      open: false,
                      rec: null,
                      actionKey: "",
                      date: todayISO,
                      time: "",
                      note: "",
                      priority: "normal",
                      remindDayBefore: true,
                    })
                  }
                  style={reminderGhostIconButton}
                >
                  ✕
                </button>
              </div>

              <div className="cic-modal-scroll">
                <div style={{ display: "grid", gap: "0.85rem" }}>
                  <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 8,
                    fontSize: "0.85rem",
                  }}
                >
                  <div className="neo-chip">
                    <strong>Ticket</strong> {reminderModal.rec?.["Ticket Number"] || "n/a"}
                  </div>
                  <div className="neo-chip">
                    <strong>Invoice</strong> {reminderModal.rec?.["Invoice Number"] || "n/a"}
                  </div>
                  <div className="neo-chip">
                    <strong>Item</strong> {reminderModal.rec?.["Item Number"] || "n/a"}
                  </div>
                  <div className="neo-chip">
                    <strong>Customer</strong> {reminderModal.rec?.["Customer Number"] || "n/a"}
                  </div>
                  <div className="neo-chip">
                    <strong>Credit</strong> {formatCurrency(reminderModal.rec?.["Credit Request Total"])}
                  </div>
                  <div className="neo-chip">
                    <strong>Days pending</strong> {computeAging(reminderModal.rec).daysPending ?? "n/a"}
                  </div>
                  <div className="neo-chip">
                    <strong>Deadline</strong>{" "}
                    {reminderModal.date
                      ? `${reminderModal.date}${reminderModal.time ? " " + reminderModal.time : ""}`
                      : "Not set"}
                  </div>
                  <div className="neo-chip">
                    <strong>Time left</strong> {timeRemainingLabel(remindersMapByKey[reminderModal.actionKey])}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: "0.8rem",
                  }}
                >
                  {[
                    { label: "In 24h", hours: 24 },
                    { label: "In 72h", hours: 72 },
                    { label: "In 96h", hours: 96 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      className="cic-pill-btn"
                      onClick={() => {
                        const target = new Date(Date.now() + opt.hours * 60 * 60 * 1000);
                        const dateStr = target.toISOString().slice(0, 10);
                        const timeStr = target.toTimeString().slice(0, 5);
                        setReminderModal((prev) => ({
                          ...prev,
                          date: dateStr,
                          time: timeStr,
                        }));
                      }}
                      style={reminderQuickButtonStyle}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#9ca3af" }}>
                  Follow-up date
                  <div style={{ position: "relative" }}>
                    <input
                      ref={reminderDateRef}
                      type="date"
                      value={reminderModal.date}
                      min={todayISO}
                      onChange={(e) => setReminderModal((prev) => ({ ...prev, date: e.target.value }))}
                      style={{ ...reminderInputStyle, paddingRight: "2.6rem" }}
                    />
                    <button
                      type="button"
                      aria-label="Open calendar"
                      className="cic-pill-btn"
                      onClick={() => {
                        const el = reminderDateRef.current;
                        if (!el) return;
                        if (typeof el.showPicker === "function") {
                          el.showPicker();
                        } else {
                          el.focus();
                          el.click();
                        }
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        left: "auto",
                        width: 42,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        background: "transparent",
                        color: "#9ca3af",
                        cursor: "pointer",
                      }}
                    >
                      🗓️
                    </button>
                  </div>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#9ca3af" }}>
                  Time (optional)
                  <input
                  type="time"
                  value={reminderModal.time}
                  onChange={(e) => setReminderModal((prev) => ({ ...prev, time: e.target.value }))}
                  style={reminderInputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#9ca3af" }}>
                  Notes / reminder text
                  <textarea
                    value={reminderModal.note}
                    onChange={(e) => setReminderModal((prev) => ({ ...prev, note: e.target.value }))}
                    rows={3}
                  style={{
                    ...reminderInputStyle,
                    resize: "vertical",
                    minHeight: "80px",
                  }}
                  placeholder="What needs to happen on follow-up?"
                />
              </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "0.5rem", color: "#e5e7eb" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={reminderModal.remindDayBefore}
                      onChange={(e) => setReminderModal((prev) => ({ ...prev, remindDayBefore: e.target.checked }))}
                    />
                    Remind me the day before
                  </label>
                  {reminderModal.remindDayBefore && (
                    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "#cbd5f5" }}>
                      <span>at</span>
                      <input
                        type="time"
                        value={reminderModal.remindTime}
                        onChange={(e) => setReminderModal((prev) => ({ ...prev, remindTime: e.target.value || "08:00" }))}
                        style={{
                          padding: "0.35rem 0.45rem",
                          borderRadius: "0.5rem",
                          border: "1px solid rgba(148,163,184,0.35)",
                          background: "rgba(15,23,42,0.9)",
                          color: "#e5e7eb",
                        }}
                      />
                    </label>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.8rem" }}>
                  {[
                    { label: "Normal", value: "normal", color: "#1f2937" },
                    { label: "Rush", value: "rush", color: "#ef4444" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="cic-pill-btn"
                      onClick={() => setReminderModal((prev) => ({ ...prev, priority: opt.value }))}
                      style={reminderPriorityButtonStyle(reminderModal.priority === opt.value, opt.color)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                </div>
              </div>

              <div
                className="cic-modal-footer"
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="cic-close-btn"
                  onClick={() =>
                    setReminderModal({
                      open: false,
                      rec: null,
                      actionKey: "",
                      date: todayISO,
                      time: "",
                      note: "",
                      priority: "normal",
                    })
                  }
                  style={reminderGhostButtonStyle}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="cic-cta-primary"
                  onClick={() => {
                    const rec = reminderModal.rec || {};
                    const actionKey = reminderModal.actionKey || generateReminderKey();
                    if (!actionKey) return;
                    const nowIso = new Date().toISOString();
                    const payload = {
                      alert_id: actionKey,
                      note: reminderModal.note,
                      due_date: reminderModal.date || null,
                      due_time: reminderModal.time || null,
                      status: "pending",
                      priority: reminderModal.priority,
                      remind_day_before: reminderModal.remindDayBefore,
                      remind_time: reminderModal.remindTime,
                      completed_at: null,
                      snoozed_until: null,
                      day_before_fired: false,
                      type: "follow_up",
                      ticket_number: rec["Ticket Number"] || rec.TicketNumber || null,
                      invoice_number: rec["Invoice Number"] || null,
                      item_number: rec["Item Number"] || null,
                      customer_number: rec["Customer Number"] || null,
                      combo_key:
                        rec["Invoice Number"] && rec["Item Number"]
                          ? `${rec["Invoice Number"]}|${rec["Item Number"]}`
                          : null,
                      tags: Array.isArray(rec.alert_flags) ? rec.alert_flags : [],
                      source: "ui",
                      updated_at: nowIso,
                      created_at: nowIso,
                      updated_by: "app",
                      created_by: "app",
                      id: actionKey,
                    };
                    onReminderSaved?.(actionKey, payload, rec);
                    setReminderModal({
                      open: false,
                      rec: null,
                      actionKey: "",
                      date: todayISO,
                      time: "",
                      note: "",
                      priority: "normal",
                      remindDayBefore: true,
                      remindTime: "08:00",
                    });
                  }}
                  style={reminderPrimaryButtonStyle}
                >
                  Save reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AlertsFilterInput({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, ...textMuted }}>
      <span style={{ color: "#8ea2c6" }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Filter ${label}`} className="input" />
    </label>
  );
}

const textMuted = { fontSize: "0.8rem", color: "#9ca3af" };

function SummaryPill({ label, value, onClick }) {
  return (
    <div
      role="button"
      onClick={typeof onClick === "function" ? onClick : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "0.65rem 0.8rem",
        borderRadius: "0.7rem",
        border: "1px solid rgba(122,242,255,0.12)",
        background: "linear-gradient(145deg, rgba(12,16,34,0.92), rgba(6,10,22,0.9))",
        color: "#e5e7eb",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: onClick ? "pointer" : "default",
        outline: "none",
      }}
    >
      <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{label}</span>
      <span style={{ fontSize: "1rem", fontWeight: 700 }}>{value.toLocaleString()}</span>
    </div>
  );
}

const icPillButtonStyle = {
  padding: "0.65rem 1.2rem",
  borderRadius: "999px",
  border: "1px solid rgba(122,242,255,0.35)",
  background: "linear-gradient(145deg, rgba(10,14,28,0.9), rgba(12,17,34,0.9))",
  color: "#e5e7eb",
  boxShadow: "0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
  cursor: "pointer",
  fontWeight: 600,
  letterSpacing: "0.01em",
};

const quickActionStyle = (activeColor) => ({
  padding: "0.35rem 0.55rem",
  borderRadius: "0.5rem",
  border: "1px solid #1f2937",
  background: activeColor,
  color: "#f8fafc",
  fontSize: "0.75rem",
  cursor: "pointer",
});

const reminderQuickButtonStyle = {
  padding: "0.4rem 0.75rem",
  borderRadius: "0.65rem",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.16))",
  color: "#dbeafe",
  cursor: "pointer",
  letterSpacing: "0.01em",
  boxShadow: "0 10px 28px rgba(59,130,246,0.22)",
};

const reminderPriorityButtonStyle = (active, activeColor) => ({
  padding: "0.4rem 0.75rem",
  borderRadius: "0.7rem",
  border: "1px solid rgba(255,255,255,0.12)",
  background: active
    ? `linear-gradient(120deg, ${activeColor}, ${activeColor === "#1f2937" ? "#0f172a" : "#b91c1c"})`
    : "rgba(255,255,255,0.03)",
  color: active ? "#f8fafc" : "#e5e7eb",
  cursor: "pointer",
  boxShadow: active ? "0 14px 34px rgba(59,130,246,0.25)" : "none",
  transition: "all 0.2s ease",
});

const reminderGhostButtonStyle = {
  padding: "0.45rem 0.85rem",
  borderRadius: "0.65rem",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#e5e7eb",
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
};

const reminderPrimaryButtonStyle = {
  padding: "0.5rem 1.05rem",
  borderRadius: "0.65rem",
  border: "1px solid rgba(59,130,246,0.9)",
  background: "linear-gradient(120deg, #3b82f6, #2563eb, #7c3aed)",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.01em",
  boxShadow:
    "0 16px 36px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.15)",
};

const reminderInputStyle = {
  padding: "0.65rem 0.7rem",
  borderRadius: "0.65rem",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(5,8,22,0.9)",
  color: "#e5e7eb",
  outline: "none",
  boxShadow: "0 14px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
};

const getReminderVisualStatus = (actionState) => {
  if (!actionState) return null;
  if (actionState.status === "completed") return "completed";
  if (actionState.status === "done") return "done";
  const dueDate = actionState.due_date;
  if (!dueDate) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dueDate === todayStr) return "due_today";
  if (dueDate < todayStr) return "overdue";
  return null;
};

const getPriorityStyle = (priority) => {
  if (priority === "ultra_rush") {
    return {
      label: "Ultra Rush",
      color: "#fef2f2",
      bg: "rgba(239,68,68,0.25)",
      shadow: "0 0 0 2px rgba(185,28,28,0.4), 0 0 18px rgba(239,68,68,0.35)",
    };
  }
  if (priority === "rush") {
    return {
      label: "Rush",
      color: "#fecdd3",
      bg: "rgba(239,68,68,0.15)",
      shadow: "0 0 0 2px rgba(239,68,68,0.25)",
    };
  }
  return null;
};

const timeRemainingLabel = (actionState) => {
  if (!actionState?.due_date) return "No deadline set";
  const due = new Date(`${actionState.due_date}${actionState.due_time ? `T${actionState.due_time}` : ""}`);
  if (Number.isNaN(due.getTime())) return "Invalid deadline";
  const diffMs = due.getTime() - Date.now();
  const sign = diffMs >= 0 ? "" : "-";
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((abs / (1000 * 60)) % 60);
  return `${sign}${days}d ${hours}h ${mins}m`;
};

export default AlertsFollowUpsTab;
