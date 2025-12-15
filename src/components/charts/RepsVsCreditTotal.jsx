import { useMemo, useState } from "react";

function normalizeRepName(name) {
  if (!name || name === "None") return "Unassigned";
  if (String(name).toLowerCase() === "nan") return "Missing Rep";
  return String(name);
}

function defaultFormatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * rows shape:
 * [
 *   { rep: "AL/NL", total: 20372.65, items: 155, accounts: 2 },
 *   ...
 * ]
 *
 * Props:
 *  - rows
 *  - formatCurrency? (optional)
 */
export default function RepsVsCreditTotal({ rows = [], formatCurrency }) {
  const [sortBy, setSortBy] = useState("total"); // "total" | "items" | "accounts"

  const fmtCurrency = formatCurrency || defaultFormatCurrency;

  const sortLabel = {
    total: "Credit Total",
    items: "Items",
    accounts: "Accounts",
  };

  const unitSuffix = {
    total: "",
    items: " items",
    accounts: " accounts",
  };

  const { sortedRows, maxMetric } = useMemo(() => {
    if (!rows.length) return { sortedRows: [], maxMetric: 1 };

    const copy = [...rows];

    copy.sort((a, b) => {
      if (sortBy === "items") {
        return (b.items || 0) - (a.items || 0);
      }
      if (sortBy === "accounts") {
        return (b.accounts || 0) - (a.accounts || 0);
      }
      return (b.total || 0) - (a.total || 0);
    });

    const maxVal = copy.reduce((max, r) => {
      if (sortBy === "items") return Math.max(max, Number(r.items || 0));
      if (sortBy === "accounts") return Math.max(max, Number(r.accounts || 0));
      return Math.max(max, Number(r.total || 0));
    }, 0);

    return { sortedRows: copy, maxMetric: maxVal || 1 };
  }, [rows, sortBy]);

  return (
    <div className="reps-card">
      <div className="reps-card__header">
        <div className="reps-card__title">
          🏆 <span>Reps vs Credit Total (alerts)</span>
        </div>

        <div className="reps-card__controls">
          <span className="reps-card__sort-label">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="reps-card__select"
          >
            <option value="total">Credit Total</option>
            <option value="items">Items</option>
            <option value="accounts">Accounts</option>
          </select>
        </div>
      </div>

      {!sortedRows.length && (
        <div className="reps-card__empty">No rep data available.</div>
      )}

      {/* key={sortBy} -> replay list animation when switching metric */}
      <div className={`reps-list reps-list--${sortBy}`} key={sortBy}>
        {sortedRows.map((row, index) => {
          const metricValue =
            sortBy === "items"
              ? Number(row.items || 0)
              : sortBy === "accounts"
              ? Number(row.accounts || 0)
              : Number(row.total || 0);

          const pctOfTop = maxMetric ? (metricValue / maxMetric) * 100 : 0;
          const pctDisplay = Math.round(pctOfTop || 0);
          const intensity = 0.22 + (pctOfTop / 100) * 0.35;
          const width = Math.max(2, pctOfTop);

          const displayAmount =
            sortBy === "total"
              ? fmtCurrency(row.total || 0)
              : `${metricValue.toLocaleString()}${unitSuffix[sortBy]}`;

          return (
            <div
              className="reps-row"
              key={row.rep || index}
              style={{ animationDelay: `${index * 40}ms` }} // stagger rows
            >
              {/* Top line: rank + rep + value + % of top */}
              <div className="reps-row__top">
                <div className="reps-row__left">
                  <span className="reps-row__rank">#{index + 1}</span>
                  <span className="reps-row__name">
                    {normalizeRepName(row.rep)}
                  </span>
                </div>
                <div className="reps-row__right">
                  <span className="reps-row__amount">{displayAmount}</span>
                  <span className="reps-row__percent">
                    ({pctDisplay}% of top)
                  </span>
                </div>
              </div>

              {/* Bar */}
              {/* BAR WITH FADE-IN + GROW ANIMATION */}
              <div className="reps-row__bar-track">
                <div
                  className="reps-row__bar-fill"
                  style={{
                    width: `${width}%`,
                    animationDelay: `${index * 40}ms`,
                    boxShadow: `0 0 14px rgba(34, 211, 238, ${intensity})`,
                    opacity: 0.75 + (pctOfTop / 100) * 0.25,
                  }}
                />
              </div>

              {/* Meta pills */}
              <div className="reps-row__meta">
                <span className="reps-row__pill">
                  🧾 {row.items ?? 0} items
                </span>
                <span className="reps-row__pill">
                  🧍 {row.accounts ?? 0} accounts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="reps-card__footer">
        Sorted by <strong>{sortLabel[sortBy]}</strong> •{" "}
        {rows.length.toLocaleString()} reps
      </div>
    </div>
  );
}
