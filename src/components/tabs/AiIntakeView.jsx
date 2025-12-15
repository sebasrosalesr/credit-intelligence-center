import { useState } from "react";
import { ref, set, update, push, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../firebase";
import { useDuplicateChecker } from "../../hooks/useDuplicateChecker";
import { API_BASE } from "../../config/apiBase";
import { CREDIT_TYPES, SALES_REPS } from "../../config/constants";

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


function AiIntakeView({ theme }) {
  const isLight = theme === "light";
  const [requestorFile, setRequestorFile] = useState(null);
  const [billingFile, setBillingFile] = useState(null);
  const [ticketNumber, setTicketNumber] = useState("");
  const [status, setStatus] = useState("Open");
  const [statusReason, setStatusReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [editableRows, setEditableRows] = useState([]);
  const [pushState, setPushState] = useState({ loading: false, message: "", error: "" });
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBillingFile, setPdfBillingFile] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [summaryCard, setSummaryCard] = useState(null);
  const [syncFile, setSyncFile] = useState(null);
  const [syncState, setSyncState] = useState({ loading: false, message: "", error: "" });
  const [roundTripCsvFile, setRoundTripCsvFile] = useState(null);
  const [roundTripData, setRoundTripData] = useState({ parsed: false, rows: [], issues: [], summary: null, diffEntries: [] });
  const { checkDuplicates } = useDuplicateChecker({ db, setError });
  const handleDownloadCsv = () => {
    if (!editableRows.length) return;
    const rows = editableRows;
    const dynamicKeys = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => dynamicKeys.add(k)));
    const headers = Array.from(dynamicKeys);
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val == null) return "";
            const str = String(val);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `ai-intake-${ticketNumber || "ticket"}-${ts}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    setError("");
    setResult(null);
    setEditableRows([]);
    setPushState({ loading: false, message: "", error: "" });
    setSummaryCard(null);
    if (!requestorFile || !billingFile) {
      setError("Requestor file and billing file are required.");
      return;
    }
    if (!ticketNumber.trim()) {
      setError("Ticket Number is required.");
      return;
    }
    if (!statusReason.trim()) {
      setError("Status notes are required.");
      return;
    }
    const form = new FormData();
    form.append("requestor_file", requestorFile);
    form.append("billing_file", billingFile);
    form.append("ticket_number", ticketNumber);
    form.append("status", status);
    if (statusReason.trim()) form.append("status_reason", statusReason.trim());
    form.append("dry_run", "false");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ingestion/ai-intake`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "Request failed"}`);
      }
      const data = await res.json();
      setResult(data);
      if (data?.input_preview) {
        const duplicateResult = await checkDuplicates(data.input_preview);
        setEditableRows(duplicateResult.rows);
        setSummaryCard({
          newRows: duplicateResult.rows.length,
          duplicates: duplicateResult.duplicates,
          matches: data.matches ? data.matches.length : 0,
        });
      } else {
        setEditableRows([]);
        setSummaryCard(null);
      }
    } catch (e) {
      setError(e.message || "Failed to run AI Intake");
    } finally {
      setLoading(false);
    }
  };

  const normalizeForPush = (row) => {
    const currentDate = new Date().toISOString().slice(0, 10);
    return {
      ...row,
      Date: currentDate,
      "Ticket Number": row["Ticket Number"]?.trim() ? row["Ticket Number"].trim() : ticketNumber,
      Status: status ? `[${getIndyTimestamp()}] ${status}${statusReason ? `: ${statusReason}` : ""}` : row.Status || "",
    };
  };

  const handlePush = async () => {
    setPushState({ loading: true, message: "", error: "" });
    const useRoundTrip = roundTripData.parsed && roundTripData.issues.length === 0;
    const sourceRows = useRoundTrip ? roundTripData.rows : editableRows;
    const { rows: annotatedRows } = await checkDuplicates(sourceRows);
    if (useRoundTrip) {
      setRoundTripData((prev) => ({ ...prev, rows: annotatedRows }));
    } else {
      setEditableRows(annotatedRows);
    }
    const rowsToSend = annotatedRows.filter((r) => !r.__firebase_duplicate);
    const skipped = annotatedRows.length - rowsToSend.length;
    if (!rowsToSend.length) {
      setPushState({ loading: false, message: "", error: "No rows to push (all are already in Firebase)." });
      return;
    }
    const normalizedRows = rowsToSend.map(normalizeForPush);

    // Direct Firebase push since backend API is not available
    try {
      if (!db) {
        throw new Error("Firebase not connected");
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of normalizedRows) {
        const { id: rowId, combo_key, ...payload } = row;
        if (combo_key) payload.combo_key = combo_key;

        try {
          if (rowId) {
            // Update existing record by ID
            await update(ref(db, `credit_requests/${rowId}`), payload);
          } else if (combo_key) {
            // Try to find by combo_key first
            const existingSnap = await get(
              query(ref(db, "credit_requests"), orderByChild("combo_key"), equalTo(combo_key))
            );
            if (existingSnap.exists()) {
              const existingKey = Object.keys(existingSnap.val())[0];
              await update(ref(db, `credit_requests/${existingKey}`), payload);
            } else {
              // Create new record
              const newRef = push(ref(db, "credit_requests"));
              await set(newRef, { ...payload, id: newRef.key });
            }
          } else {
            // Create new record without combo_key
            const newRef = push(ref(db, "credit_requests"));
            await set(newRef, { ...payload, id: newRef.key });
          }
          successCount++;
        } catch (err) {
          console.error("Firebase push error for row:", row, err);
          errorCount++;
        }
      }

      setPushState({
        loading: false,
        message: `Pushed ${successCount} row(s) to Firebase${errorCount > 0 ? ` (${errorCount} errors)` : ""}${skipped > 0 ? ` · Skipped ${skipped} duplicate(s)` : ""}${useRoundTrip ? ` (from CSV round-trip)` : ""}`,
        error: errorCount > 0 ? `${errorCount} rows failed to push` : "",
      });
    } catch (e) {
      setPushState({ loading: false, message: "", error: e.message || "Push failed" });
    }
  };

  const handleParsePdf = async () => {
    setPdfLoading(true);
    setError("");
    setResult(null);
    setEditableRows([]);
    setPushState({ loading: false, message: "", error: "" });
    setSummaryCard(null);
    if (!pdfFile) {
      setError("PDF file is required.");
      setPdfLoading(false);
      return;
    }
    const form = new FormData();
    form.append("pdf_file", pdfFile);
    form.append("prefer_account_code", "true");
    form.append("db_url", "https://creditapp-tm-default-rtdb.firebaseio.com/");
    if (pdfBillingFile) form.append("billing_file", pdfBillingFile);

    try {
      const res = await fetch(`${API_BASE}/ingestion/pdf-invoice`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "PDF parse failed"}`);
      }
      const data = await res.json();
      const rows = data.rows || [];
      const matches = data.matches || [];
      setEditableRows(rows);
      setResult({
        mode: "pdf_invoice",
        requestor_format: "PDF Invoice",
        dry_run: true,
        df_std: rows,
        matches,
        input_preview: rows,
        stats: null,
        firebase_warnings: data.firebase_warnings || [],
      });
      setSummaryCard({
        newRows: rows.length,
        duplicates: rows.filter((r) => r.__firebase_duplicate).length,
        matches: matches.length,
      });
    } catch (e) {
      setError(e.message || "Failed to parse PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSyncCrNumbers = async () => {
    setSyncState({ loading: true, message: "", error: "" });
    if (!syncFile) {
      setSyncState({ loading: false, message: "", error: "Billing master file is required." });
      return;
    }
    const form = new FormData();
    form.append("billing_file", syncFile);
    form.append("dry_run", "false");
    form.append("db_url", "https://creditapp-tm-default-rtdb.firebaseio.com/");

    try {
      const res = await fetch(`${API_BASE}/ingestion/sync-cr-numbers`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSyncState({
        loading: false,
        message: `Checked ${data.checked || 0}, matched ${data.matched || 0}, updated ${
          data.updated || 0
        } record(s).`,
        error: "",
      });
    } catch (e) {
      setSyncState({ loading: false, message: "", error: e.message || "Sync failed" });
    }
  };

  const handleValidateRoundTrip = async () => {
    if (!roundTripCsvFile) return;
    const originalRows = editableRows;

    console.log('Starting round-trip validation with', originalRows.length, 'rows');

    try {
      const text = await roundTripCsvFile.text();
      const csvRows = (() => {
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
            const raw = cells[idx] ?? "";
            const normalizedHeader = h.trim();
            if (normalizedHeader === "__firebase_duplicate") {
              obj[h] = ["true", "1", "yes"].includes(String(raw).trim().toLowerCase());
            } else {
              obj[h] = raw;
            }
          });
          return obj;
        });
      })();

      console.log('Parsed CSV rows:', csvRows.length);

      const issues = [];
      const diffEntries = [];
      const seenCombos = new Set();

      // Build lookup maps from original rows
      const byId = new Map();
      const byCombo = new Map();
      originalRows.forEach((r) => {
        if (r.id) byId.set(r.id, r);
        const c = r.combo_key || (r["Invoice Number"] && r["Item Number"] ? `${r["Invoice Number"]}|${r["Item Number"]}` : null);
        if (c) byCombo.set(c, r);
      });

      // Process each CSV row
      const updatedRows = [];
      let updates = 0;
      let inserts = 0;

      csvRows.forEach((csvRow, idx) => {
        const rowIdx = idx + 2;
        const inv = csvRow["Invoice Number"];
        const item = csvRow["Item Number"];
        const csvCombo = csvRow.combo_key || (inv && item ? `${inv}|${item}` : null);
        const csvId = csvRow.id || csvRow.Id || csvRow.ID;

        console.log(`CSV row ${idx}: id=${csvId}, combo=${csvCombo}, credit_total=${csvRow["Credit Request Total"]}`);

        // Check for required identifiers
        if (!csvId && !csvCombo) {
          issues.push(`Row ${rowIdx}: missing id and combo_key (Invoice+Item).`);
        }

        // Check for duplicates in CSV
        if (csvCombo && seenCombos.has(csvCombo)) {
          issues.push(`Row ${rowIdx}: duplicate combo_key ${csvCombo} in CSV.`);
        } else if (csvCombo) {
          seenCombos.add(csvCombo);
        }

        // Find existing row to merge with or use CSV row as base
        const existingRow = byId.get(csvId) || (csvCombo && byCombo.get(csvCombo));
        const baseRow = existingRow || csvRow;

        const mergedRow = { ...baseRow };
        let hasChanges = false;
        const changed = {};

        // Special handling for Date - always replace with today's date during round-trip
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        if (String(baseRow.Date || "") !== today) {
          console.log(`Updating Date: "${baseRow.Date}" -> "${today}" for ${csvCombo || csvId}`);
          mergedRow.Date = today;
          changed.Date = { from: baseRow.Date, to: today };
          hasChanges = true;
        }

        // Merge other CSV values, tracking changes
        [
          "Customer Number",
          "Invoice Number",
          "Item Number",
          "QTY",
          "Credit Type",
          "Issue Type",
          "Ticket Number",
          "RTN_CR_No",
          "Sales Rep",
          "Credit Request Total",
        ].forEach((field) => {
          const baseVal = baseRow[field];
          const csvVal = csvRow[field];

          // Check for significant changes (not just empty/null vs empty/null)
          const baseEmpty = !baseVal || baseVal === "" || baseVal === null;
          const csvEmpty = !csvVal || csvVal === "" || csvVal === null;
          const bothEmpty = baseEmpty && csvEmpty;

          if (!bothEmpty && String(baseVal ?? "") !== String(csvVal ?? "")) {
            console.log(`Updating ${field}: "${baseVal}" -> "${csvVal}" for ${csvCombo || csvId}`);
            mergedRow[field] = csvVal;
            changed[field] = { from: baseVal, to: csvVal };
            hasChanges = true;
          }
        });

        if (hasChanges) {
          updates++;
          if (Object.keys(changed).length) {
            diffEntries.push({
              id: csvId || "",
              combo: csvCombo || "",
              changed,
            });
          }
        }

        // If this is a new row from CSV, count as insert
        if (!existingRow) {
          inserts++;
        }

        updatedRows.push(mergedRow);
      });

      console.log(`Updating editableRows: ${updates} updates, ${inserts} inserts`);

      const duplicateResult = await checkDuplicates(updatedRows);
      const annotatedRows = duplicateResult.rows;
      setEditableRows(annotatedRows);

      const summary = { updates, inserts, total: csvRows.length };
      setRoundTripData({ parsed: true, rows: annotatedRows, issues, summary, diffEntries });

      console.log('Validation complete:', { updates, inserts, total: csvRows.length, issues: issues.length });

    } catch (e) {
      console.error('Round-trip validation error:', e);
      setRoundTripData({ parsed: false, rows: [], issues: [e.message], summary: null, diffEntries: [] });
    }
  };

  const EDITABLE_FIELDS = new Set([
    "Issue Type",
    "QTY",
    "Unit Price",
    "Corrected Unit Price",
    "Credit Request Total",
    "Requested By",
    "Reason for Credit",
    "Credit Type",
    "Sales Rep",
    "__firebase_duplicate",
  ]);

  const renderTable = (rows, title, { editable = false } = {}) => {
    if (!rows || rows.length === 0) {
      return (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #1f2937",
            background: "#0b1224",
            color: "#9ca3af",
          }}
        >
          {title}: No rows
        </div>
      );
    }
    const reviewCols = [
      "Invoice Number",
      "Item Number",
      "Credit Type",
      "Sales Rep",
      "Issue Type",
      "QTY",
      "Unit Price",
      "Corrected Unit Price",
      "Credit Request Total",
      "Requested By",
      "Reason for Credit",
    ];
    let cols = [...reviewCols];
    const hasDup =
      rows && rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "__firebase_duplicate");
    if (hasDup) {
      cols.push("__firebase_duplicate");
    }
    const limited = rows; // show all rows
    const cardBg = isLight ? "#ffffff" : "#0b1224";
    const cardBorder = isLight ? "#d9e4f5" : "#1f2937";
    const cardHeaderBg = isLight ? "#f4f7fc" : "#0b1224";
    const cardHeaderText = isLight ? "#111827" : "#e5e7eb";
    const rowBg = isLight ? "#f7f8fc" : "#020617";
    const rowBgAlt = isLight ? "#eff2f9" : "#030712";
    const rowText = isLight ? "#0f172a" : "#e5e7eb";

    return (
      <div
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: "0.65rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.65rem 0.85rem",
            borderBottom: `1px solid ${cardBorder}`,
            background: cardHeaderBg,
            color: cardHeaderText,
            fontSize: "0.9rem",
          }}
        >
          {title} (showing {limited.length.toLocaleString()} of {rows.length.toLocaleString()})
        </div>
        <div style={{ maxHeight: 320, overflow: "auto" }}>
      <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.82rem",
            }}
          >
            <thead>
              <tr style={{ background: cardHeaderBg }}>
                {cols.map((c) => (
                  <th
                    key={c}
                    style={{
                      padding: "0.45rem 0.55rem",
                      textAlign: "left",
                      color: isLight ? "#4b5563" : "#9ca3af",
                      position: "sticky",
                      top: 0,
                      background: cardHeaderBg,
                      zIndex: 1,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limited.map((row, idx) => (
                <tr
                  key={idx}
                  className="row-animate"
                  style={{
                    borderTop: `1px solid ${isLight ? "rgba(0,0,0,0.06)" : "#111827"}`,
                    background: idx % 2 === 0 ? rowBg : rowBgAlt,
                    animationDelay: `${idx * 20}ms`,
                  }}
                >
                  {cols.map((c) => {
                    const rawVal = row[c];
                    const val = rawVal != null && rawVal !== "" ? String(rawVal) : "";
                    const showDash = val === "";
                    const canEdit = editable && EDITABLE_FIELDS.has(c) && c !== "__firebase_duplicate";
                    return (
                      <td key={c} style={{ padding: "0.45rem 0.55rem", color: rowText }}>
                        {c === "__firebase_duplicate" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.6rem",
                              border: `1px solid ${cardBorder}`,
                              background: rawVal
                                ? isLight
                                  ? "rgba(248,113,113,0.14)"
                                  : "rgba(248,113,113,0.16)"
                                : isLight
                                ? "rgba(22,163,74,0.12)"
                                : "rgba(34,197,94,0.16)",
                              color: rawVal ? "#b91c1c" : "#15803d",
                              fontSize: "0.75rem",
                            }}
                          >
                            {rawVal ? "Already in Firebase" : "New record"}
                          </span>
                        ) : canEdit && c === "Credit Type" ? (
                          <select
                            value={val}
                            onChange={(e) =>
                              setEditableRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], [c]: e.target.value };
                                return next;
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "0.35rem 0.45rem",
                              borderRadius: "0.4rem",
                              border: `1px solid ${cardBorder}`,
                              background: cardBg,
                              color: rowText,
                            }}
                          >
                            <option value="">(leave blank)</option>
                            {!CREDIT_TYPES.includes(row[c]) && row[c] ? (
                              <option value={row[c]}>{`Keep: ${row[c]}`}</option>
                            ) : null}
                            {CREDIT_TYPES.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : canEdit && c === "Sales Rep" ? (
                          <select
                            value={val}
                            onChange={(e) =>
                              setEditableRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], [c]: e.target.value };
                                return next;
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "0.35rem 0.45rem",
                              borderRadius: "0.4rem",
                              border: `1px solid ${cardBorder}`,
                              background: cardBg,
                              color: rowText,
                            }}
                          >
                            {SALES_REPS.map((opt, i) => (
                              <option key={`${opt}-${i}`} value={opt}>
                                {opt || "—"}
                              </option>
                            ))}
                          </select>
                        ) : canEdit ? (
                          <input
                            value={val}
                            onChange={(e) =>
                              setEditableRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], [c]: e.target.value };
                                return next;
                              })
                            }
                            style={{
                              width: "100%",
                              padding: "0.35rem 0.45rem",
                              borderRadius: "0.4rem",
                              border: `1px solid ${cardBorder}`,
                              background: cardBg,
                              color: rowText,
                            }}
                          />
                        ) : showDash ? (
                          "—"
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-intake-shell neo-fade-in">
      <div className="ai-intake-actions">
        <div className="ai-intake-actions__left">
          <span className="ai-intake-pill">AI Intake Engine</span>
          <span className="ai-intake-sub">
            Upload requestor + billing files, optionally parse a PDF, then push to Firebase.
          </span>
        </div>
        <div className="ai-intake-actions__right">
          <button
            type="button"
            className="neo-btn-secondary"
            onClick={handleDownloadCsv}
            disabled={!editableRows.length}
          >
            Download CSV
          </button>
          <button
            type="button"
            className="neo-btn-green"
            onClick={handlePush}
            disabled={pushState.loading || !editableRows.length}
            title={
              !editableRows.length
                ? "Run intake first to generate rows"
                : "Push transformed rows into Firebase"
            }
          >
            {pushState.loading ? "Pushing..." : "Push to Firebase"}
          </button>
          <button
            type="button"
            className="neo-btn-primary"
            onClick={handleSubmit}
            disabled={loading || !requestorFile || !billingFile}
            title={!requestorFile || !billingFile ? "Attach requestor + billing files first" : "Run AI Intake"}
          >
            {loading ? "Running..." : "Run AI Intake"}
          </button>
        </div>
      </div>

      <div className="ai-intake-grid">
        <div className="ai-intake-steps">
          <section className={`ai-section neo-section ${requestorFile && billingFile ? "completed" : ""}`}>
            <div className="neo-spine" />
            <header className="ai-section__header">
              <div className="ai-section__title-row">
                <div className="ai-section__icon">1</div>
                <div>
                  <h2 className="ai-section__title">Upload Source Files</h2>
                  <p className="ai-section__subtitle">
                    Requestor + billing master go through the intake pipeline.
                  </p>
                </div>
              </div>
              <span className="ai-step-tag">Required</span>
            </header>

            <div className="ai-section__body">
              <div className="ai-row ai-row--2">
                <div>
                  <label className="neo-label">
                    Requestor File <span className="neo-label-required">*</span>
                  </label>
                  <label className={`neo-file ${requestorFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {requestorFile ? requestorFile.name : "Choose file…"}
                    </span>
                    <input type="file" onChange={(e) => setRequestorFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className="neo-label">
                    Billing File <span className="neo-label-required">*</span>
                  </label>
                  <label className={`neo-file ${billingFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {billingFile ? billingFile.name : "Choose file…"}
                    </span>
                    <input type="file" onChange={(e) => setBillingFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

              </div>
            </div>
          </section>

          <section className={`ai-section neo-section ${pdfFile ? "completed" : ""}`}>
            <div className="neo-spine" />
            <header className="ai-section__header">
              <div className="ai-section__title-row">
                <div className="ai-section__icon">2</div>
                <div>
                  <h2 className="ai-section__title">
                    Parse PDF Invoice <span className="ai-section__optional">(optional)</span>
                  </h2>
                  <p className="ai-section__subtitle">
                    Convert PDFs into the standard schema and cross-check amounts.
                  </p>
                </div>
              </div>
              <span className="ai-step-tag ai-step-tag--optional">Optional</span>
            </header>

            <div className="ai-section__body">
              <div className="ai-row ai-row--2">
                <div>
                  <label className="neo-label">PDF Invoice</label>
                  <label className={`neo-file ${pdfFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {pdfFile ? pdfFile.name : "Choose PDF…"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div>
                  <label className="neo-label">Billing Master (for validation)</label>
                  <label className={`neo-file ${pdfBillingFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {pdfBillingFile ? pdfBillingFile.name : "Choose file…"}
                    </span>
                    <input type="file" onChange={(e) => setPdfBillingFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="neo-btn-outline"
                style={{ marginTop: "0.9rem" }}
                onClick={handleParsePdf}
                disabled={!pdfFile || pdfLoading}
              >
                {pdfLoading ? "Parsing PDF..." : "Parse PDF"}
              </button>
            </div>
          </section>

          <section className="ai-section neo-section">
            <div className="neo-spine" />
            <header className="ai-section__header">
              <div className="ai-section__title-row">
                <div className="ai-section__icon">3</div>
                <div>
                  <h2 className="ai-section__title">Ticket Info</h2>
                  <p className="ai-section__subtitle">
                    Attach ticket metadata for tracing in iTop / internal systems.
                  </p>
                </div>
              </div>
              <span className="ai-step-tag">Context</span>
            </header>

            <div className="ai-section__body">
              <div className="ai-row ai-row--3">
                <div>
                  <label className="neo-label">Ticket Number</label>
                  <input
                    className="neo-input"
                    placeholder="e.g. CS-12345"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="neo-label">Status</label>
                  <select className="neo-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Open">Open</option>
                    <option value="WIP">WIP</option>
                    <option value="Submitted to Billing">Submitted to Billing</option>
                    <option value="Pending">Pending</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "0.9rem" }}>
                <label className="neo-label">
                  Status notes <span className="neo-label-required">*</span>
                </label>
                <textarea
                  className="neo-textarea"
                  placeholder="Add status notes..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>

            </div>
          </section>

          <section className="ai-section neo-section">
            <div className="neo-spine" />
            <header className="ai-section__header">
              <div className="ai-section__title-row">
                <div className="ai-section__icon">4</div>
                <div>
                  <h2 className="ai-section__title">Sync RTN/CR Numbers</h2>
                  <p className="ai-section__subtitle">
                    Use billing master to populate missing RTN/CR numbers in Firebase.
                  </p>
                </div>
              </div>
              <span className="ai-step-tag ai-step-tag--optional">Optional</span>
            </header>

            <div className="ai-section__body">
              <div className="ai-row ai-row--2">
                <div>
                  <label className="neo-label">Billing Master (RTN/CR)</label>
                  <label className={`neo-file ${syncFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {syncFile ? syncFile.name : "Choose file…"}
                    </span>
                    <input type="file" onChange={(e) => setSyncFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="neo-btn-green"
                style={{ marginTop: "0.9rem" }}
                onClick={handleSyncCrNumbers}
                disabled={!syncFile || syncState.loading}
              >
                {syncState.loading ? "Syncing..." : "Sync RTN/CR"}
              </button>

              {(syncState.message || syncState.error) && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "0.55rem",
                    border: syncState.error
                      ? "1px solid rgba(248,113,113,0.4)"
                      : "1px solid rgba(52,211,153,0.4)",
                    background: syncState.error ? "rgba(248,113,113,0.08)" : "rgba(16,185,129,0.12)",
                    color: syncState.error ? "#fecdd3" : "#bbf7d0",
                    fontSize: "0.85rem",
                  }}
                >
                  {syncState.error || syncState.message}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="ai-intake-summary neo-section">
          <h3 className="ai-summary__title">Run summary</h3>
          <p className="ai-summary__subtitle">Quick snapshot of what will go through the pipeline.</p>

          <div className="ai-summary__group">
            <div className="ai-summary__row">
              <span>Requestor file</span>
              <span className="ai-summary__value">
                {requestorFile ? "Attached" : "Missing"}
              </span>
            </div>
            <div className="ai-summary__row">
              <span>Billing file</span>
              <span className="ai-summary__value">
                {billingFile ? "Attached" : "Missing"}
              </span>
            </div>
            <div className="ai-summary__row">
              <span>PDF invoice</span>
              <span className="ai-summary__value">
                {pdfFile ? "Attached" : "—"}
              </span>
            </div>
          </div>

          <div className="ai-summary__group">
            <div className="ai-summary__row">
              <span>Ticket</span>
              <span className="ai-summary__value">
                {ticketNumber || "n/a"}
              </span>
            </div>
            <div className="ai-summary__row">
              <span>Status</span>
              <span className="ai-summary__value">{status}</span>
            </div>
          </div>

        </aside>
      </div>

      {error && (
        <div
          style={{
            padding: "0.65rem 0.8rem",
            borderRadius: "0.55rem",
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(248,113,113,0.08)",
            color: "#fecdd3",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {summaryCard && (
            <div
              className="panel"
              style={{
                padding: "0.9rem 1rem",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "1rem" }}>Summary</h4>
              <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                • {summaryCard.newRows.toLocaleString()} new credit row(s)
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                • {summaryCard.duplicates.toLocaleString()} duplicate(s)
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                • {summaryCard.matches.toLocaleString()} match(es) in billing
              </div>
            </div>
          )}
          <div
            className="panel"
            style={{
              padding: "1rem",
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: "0.95rem" }}>
              Mode: <strong style={{ color: "#e5e7eb" }}>{result.mode}</strong> · Requestor format:{" "}
              <strong style={{ color: "#e5e7eb" }}>
                {result.requestor_format || "Unknown"}
              </strong>
            </div>
            {result.stats && (
              <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                {Array.isArray(result.stats.details)
                  ? result.stats.details.join(" | ")
                  : JSON.stringify(result.stats)}
              </div>
            )}
          </div>

          <div
            className="panel"
            style={{
              padding: "1rem",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "1.3rem", color: "#e5e7eb" }}>
              Step 3: Review & Edit Rows
            </h4>
            <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              Edit Credit Type and Sales Rep per row (preview only).
            </div>
            {result.matches && result.matches.length > 0 && renderTable(result.matches, "Matches (already in billing)")}
            {editableRows && editableRows.length > 0 && renderTable(editableRows, "Input stage preview (new request)", { editable: true })}
            {!result.matches?.length && !editableRows.length && result.df_std && result.df_std.length > 0 && renderTable(result.df_std, "Normalized requestor rows")}
            {result.firebase_warnings && result.firebase_warnings.length > 0 && (
              <div
                style={{
                  padding: "0.65rem 0.8rem",
                  borderRadius: "0.55rem",
                  border: "1px solid rgba(248,113,113,0.4)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#fecdd3",
                  fontSize: "0.85rem",
                }}
              >
                {result.firebase_warnings.join(" | ")}
              </div>
            )}
            {(pushState.message || pushState.error) && (
              <div
                style={{
                  padding: "0.65rem 0.8rem",
                  borderRadius: "0.55rem",
                  border: pushState.error
                    ? "1px solid rgba(248,113,113,0.4)"
                    : "1px solid rgba(34,197,94,0.35)",
                  background: pushState.error
                    ? "rgba(248,113,113,0.08)"
                    : "rgba(34,197,94,0.08)",
                  color: pushState.error ? "#fecdd3" : "#86efac",
                  fontSize: "0.85rem",
                }}
              >
                {pushState.error || pushState.message}
              </div>
            )}
          </div>

          {editableRows.length > 0 && (
            <div className="panel" style={{ padding: "1rem" }}>
              <h4 style={{ margin: 0, fontSize: "1.3rem", color: "#e5e7eb" }}>
                Step 4: CSV Round-trip (Optional)
              </h4>
              <div style={{ color: "#9ca3af", fontSize: "0.9rem", marginBottom: "1rem" }}>
                Export the processed data to CSV, edit externally, then upload back for final validation before push.
              </div>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="neo-btn-outline"
                  onClick={handleDownloadCsv}
                  disabled={!editableRows.length}
                  title="Export current processed rows as CSV for external editing"
                >
                  Export CSV to Edit
                </button>
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                After editing the CSV externally, upload it back below for validation.
              </div>
              <div className="ai-row ai-row--2">
                <div>
                  <label className={`neo-file ${roundTripCsvFile ? "has-file" : ""}`}>
                    <span className="neo-file__label">
                      {roundTripCsvFile ? roundTripCsvFile.name : "Choose edited CSV…" }
                    </span>
                    <input type="file" accept=".csv" onChange={(e) => setRoundTripCsvFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div>
                  <button
                    type="button"
                    className="neo-btn-outline"
                    onClick={handleValidateRoundTrip}
                    disabled={!roundTripCsvFile || roundTripData.parsed}
                  >
                    {roundTripData.parsed ? "Validated" : "Validate Round-trip"}
                  </button>
                </div>
              </div>
              {roundTripData.parsed && (
                <div>
                  <div style={{ color: "#9ca3af", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    Round-trip Summary: {roundTripData.summary.updates} updates, {roundTripData.summary.total} total rows.
                  </div>
                  {roundTripData.issues.length > 0 && (
                    <div style={{ padding: "0.65rem", borderRadius: "0.55rem", border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)", color: "#fecdd3", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      Issues: {roundTripData.issues.join(" | ")}
                    </div>
                  )}
                  <div>
                    <strong>Differences:</strong>
                    {roundTripData.diffEntries.length === 0 ? (
                      <div>No changes detected.</div>
                    ) : (
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                        {roundTripData.diffEntries.map((entry, idx) => (
                          <div key={idx}>
                            {entry.combo} - {Object.entries(entry.changed).map(([k, v]) => `${k}: ${v.from} -> ${v.to}`).join(', ')}
                          </div>
                        ))}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



export default AiIntakeView;
