import React from "react";

export default function LargestCreditsTable({ analytics, topCredits, formatCurrency }) {
  const toNumber = (value) => {
    if (value == null || value === "") return 0;
    const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const largest = (analytics?.largestCredits && analytics.largestCredits.length ? analytics.largestCredits : topCredits) || [];
  const maxAmount = largest.length
    ? Math.max(...largest.map((rec) => toNumber(rec["Credit Request Total"])))
    : 0;

  if (largest.length === 0) return null;

  return (
    <section
      className="panel"
      style={{
        marginTop: "1.5rem",
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: "0.6rem",
          fontSize: "0.95rem",
          color: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        💰 Largest Credits (top 10)
        <span
          style={{
            fontSize: "0.75rem",
            color: "#9ca3af",
            fontWeight: 400,
          }}
        >
          Ranked by Credit Request Total
        </span>
      </h3>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.84rem",
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.35rem 0.4rem", color: "#9ca3af", fontWeight: 500 }}>Date</th>
            <th style={{ textAlign: "left", padding: "0.35rem 0.4rem", color: "#9ca3af", fontWeight: 500 }}>Customer #</th>
            <th style={{ textAlign: "left", padding: "0.35rem 0.4rem", color: "#9ca3af", fontWeight: 500 }}>Ticket #</th>
            <th style={{ textAlign: "left", padding: "0.35rem 0.4rem", color: "#9ca3af", fontWeight: 500 }}>Sales Rep</th>
            <th
              style={{
                textAlign: "right",
                padding: "0.35rem 0.4rem",
                color: "#9ca3af",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Credit Total
            </th>
          </tr>
        </thead>
        <tbody>
          {largest.map((rec, idx) => {
            const amount = toNumber(rec["Credit Request Total"]);
            const pct = maxAmount ? Math.max(0.08, amount / maxAmount) : 0;
            const isEven = idx % 2 === 0;

            return (
              <tr
                key={rec.id || `${rec["Invoice Number"]}-top-${idx}`}
                style={{
                  borderTop: "1px solid #0b1120",
                  background: isEven ? "#020617" : "#030712",
                }}
              >
                <td style={{ padding: "0.35rem 0.4rem", color: "#e5e7eb" }}>{rec.Date || "—"}</td>
                <td style={{ padding: "0.35rem 0.4rem", color: "#e5e7eb" }}>{rec["Customer Number"] || "—"}</td>
                <td style={{ padding: "0.35rem 0.4rem", color: "#e5e7eb" }}>{rec["Ticket Number"] || "—"}</td>
                <td style={{ padding: "0.35rem 0.4rem", color: "#cbd5f5" }}>
                  {rec["Sales Rep"] && rec["Sales Rep"] !== "None" ? rec["Sales Rep"] : "n/a"}
                </td>
                <td
                  style={{
                    position: "relative",
                    padding: "0.35rem 0.4rem",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      bottom: "4px",
                      right: "0.4rem",
                      width: `${pct * 100}%`,
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, rgba(56,189,248,0.22), rgba(45,212,191,0.36))",
                      opacity: 0.9,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      color: "#e0f2fe",
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(amount)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
