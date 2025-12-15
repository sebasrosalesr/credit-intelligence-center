import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Th, Td } from "../common/TableCells.jsx";

export default function RiskScoresTab({ records, formatCurrency, toNumber }) {
  const [query, setQuery] = useState("");
  const getAlertTone = (score) => {
    if (score == null || Number.isNaN(score)) return "risk-score-pill--muted";
    if (score >= 80) return "risk-score-pill--high";
    if (score >= 60) return "risk-score-pill--mid";
    return "risk-score-pill--low";
  };

  const ranked = useMemo(() => {
    return [...records]
      .filter((r) => r.alert_score != null)
      .sort((a, b) => (b.alert_score || 0) - (a.alert_score || 0))
      .slice(0, 200);
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((rec) => {
      const fields = [
        rec["Ticket Number"],
        rec["Customer Number"],
        rec["Invoice Number"],
        rec["Item Number"],
        Array.isArray(rec.alert_flags) ? rec.alert_flags.join(" ") : "",
      ];
      return fields.some((f) => String(f || "").toLowerCase().includes(q));
    });
  }, [ranked, query]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      "Date",
      "Ticket",
      "Customer",
      "Invoice",
      "Item",
      "Credit Total",
      "Alert Score",
      "Flags",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((rec) => {
      const row = [
        rec.Date || "",
        rec["Ticket Number"] || "",
        rec["Customer Number"] || "",
        rec["Invoice Number"] || "",
        rec["Item Number"] || "",
        toNumber(rec["Credit Request Total"]),
        rec.alert_score ?? "",
        Array.isArray(rec.alert_flags) ? rec.alert_flags.join("|") : "",
      ].map((v) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "risk_scores.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="risk-table-container"
      style={{ margin: "0 auto", width: "100%", maxWidth: "1400px", paddingTop: "0.5rem" }}
    >
      <div className="risk-table-head">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>Top 200 by alert_score (from Firebase)</span>
          <span>Showing {filtered.length} of {ranked.length} records</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Filter by ticket, customer, invoice, item, flags"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              minWidth: "320px",
              padding: "0.55rem 0.75rem",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              color: "#e5e7eb",
              outline: "none",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              transition: "border-color 150ms ease, box-shadow 150ms ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(122, 242, 255, 0.35)";
              e.target.style.boxShadow = "0 10px 32px rgba(122,242,255,0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.08)";
              e.target.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
            }}
          />
          <button type="button" onClick={exportCsv} className="risk-export">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
      <div style={{ maxHeight: "520px", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Ticket</Th>
              <Th>Customer</Th>
              <Th>Invoice</Th>
              <Th>Item</Th>
              <Th>Credit Total</Th>
              <Th>Alert Score</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec, idx) => (
              <tr key={rec.id || `${rec["Invoice Number"]}-${idx}`} className="risk-row">
                <Td>{rec.Date || ""}</Td>
                <Td>{rec["Ticket Number"] || "-"}</Td>
                <Td>{rec["Customer Number"] || "-"}</Td>
                <Td>{rec["Invoice Number"] || "-"}</Td>
                <Td>{rec["Item Number"] || "-"}</Td>
                <Td>{formatCurrency(rec["Credit Request Total"])}</Td>
                <Td>
                  <span className={`risk-score-pill ${getAlertTone(rec.alert_score)}`}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "currentColor",
                        display: "inline-block",
                        opacity: 0.9,
                      }}
                    />
                    {rec.alert_score != null ? `${rec.alert_score}` : "-"}
                  </span>
                </Td>
                <Td className="risk-flags">
                  {Array.isArray(rec.alert_flags) && rec.alert_flags.length > 0
                    ? rec.alert_flags.join(", ")
                    : "-"}
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No alert scores found. Ensure the Python alert engine has written alert_score/alert_flags to Firebase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
