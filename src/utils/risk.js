/**
 * Compute a structured risk score with normalization, dollar severity, aging mix, trend, and configurable thresholds.
 *
 * Inputs object shape:
 *  - allSummary: { count, pending }
 *  - filteredSummary: { count, pending }
 *  - slaBuckets: { "<30d>": { count, total }, "30-59d": { count, total }, "60d+": { count, total } }
 *  - highDollarTickets: array of [ticket, total] entries
 *  - highDollarTotal: number (optional, if already summed)
 *  - trendPct: number (optional, pending % change vs prior period)
 *  - thresholds: { medium: number, high: number } (optional overrides)
 */
export function computeRiskIndex({
  allSummary = {},
  filteredSummary = {},
  slaBuckets = {},
  highDollarTickets = [],
  highDollarTotal = 0,
  trendPct = 0,
  thresholds,
}) {
  const clampNum = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const pending = clampNum(filteredSummary.pending ?? allSummary.pending ?? 0);
  const totalCount = clampNum(filteredSummary.count ?? allSummary.count ?? 0) || 1;

  const sla60 = clampNum(slaBuckets?.["60d+"]?.count);
  const sla30 = clampNum(slaBuckets?.["30-59d"]?.count);
  const pendingForAging = Math.max(1, pending || totalCount);

  const dollarTotal =
    clampNum(highDollarTotal) ||
    (Array.isArray(highDollarTickets)
      ? highDollarTickets.reduce((sum, [, total]) => sum + clampNum(total), 0)
      : 0);
  const dollarCount = Array.isArray(highDollarTickets) ? highDollarTickets.length : 0;

  // Factors (0-1) then weighted to a 0-100 composite
  const pendingFactor = clamp01(pending / totalCount) * 35; // load normalized by volume
  const agingFactor = clamp01((sla60 + sla30 * 0.5) / pendingForAging) * 35; // aging mix
  const highDollarFactor =
    clamp01(dollarTotal / 50000) * 20 + clamp01(dollarCount / 5) * 5; // dollar exposure + count
  const trendAdj =
    trendPct > 0
      ? clamp01(trendPct / 50) * 10 // rising pending increases risk
      : -clamp01(Math.abs(trendPct) / 50) * 5; // decreasing pending lowers risk slightly

  let rawScore = pendingFactor + agingFactor + highDollarFactor + trendAdj;
  rawScore = Math.max(0, rawScore);
  const score = Math.round(rawScore);

  const th = {
    medium: clampNum(thresholds?.medium ?? 35),
    high: clampNum(thresholds?.high ?? 65),
  };

  let label = "Low";
  if (score >= th.high) label = "High";
  else if (score >= th.medium) label = "Medium";

  return {
    label,
    score,
    factors: {
      pending: Math.round(pendingFactor),
      aging: Math.round(agingFactor),
      highDollar: Math.round(highDollarFactor),
      trend: Math.round(trendAdj),
    },
    inputs: {
      pending,
      totalCount,
      sla60,
      sla30,
      dollarTotal,
      dollarCount,
      trendPct,
    },
    thresholds: th,
  };
}

export function getSlaBadge(daysPending) {
  if (daysPending == null) {
    return { label: "n/a", color: "#9ca3af", bg: "rgba(148,163,184,0.15)" };
  }
  if (daysPending >= 60) {
    return { label: "60d+", color: "#f87171", bg: "rgba(248,113,113,0.18)" };
  }
  if (daysPending >= 30) {
    return { label: "30-59d", color: "#facc15", bg: "rgba(250,204,21,0.18)" };
  }
  return { label: "<30d", color: "#34d399", bg: "rgba(52,211,153,0.18)" };
}
