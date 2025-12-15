import SummaryCard from "./SummaryCard.jsx";

export default function SummaryStrip({
  summary,
  filteredSummary,
  isFiltered,
  duplicateStats,
  showSkeletons,
  formatCurrency,
  riskIndex,
  Skeleton,
}) {
  const displayed = isFiltered ? filteredSummary : summary;

  return (
    <section
      className="summary-grid"
      style={{
        opacity: showSkeletons ? 0.6 : 1,
      }}
    >
      <SummaryCard
        label="Risk Index"
        value={
          riskIndex?.label
            ? `${riskIndex.label} (${riskIndex.score ?? "-"})`
            : "n/a"
        }
        subtitle="Pending load, aging mix, >$2.5k exposure, trend"
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
      <SummaryCard
        label={isFiltered ? "Filtered Credits" : "Total Credits"}
        value={displayed.count}
        subtitle={isFiltered ? "records (current filters)" : "records (all)"}
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
      <SummaryCard
        label={isFiltered ? "Filtered Credit Amount" : "Total Credit Amount"}
        value={formatCurrency(displayed.total)}
        subtitle={
          isFiltered ? "sum of Credit Request Total (filtered)" : "sum of Credit Request Total (all)"
        }
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
      <SummaryCard
        label={isFiltered ? "Filtered Average" : "Average per Credit"}
        value={formatCurrency(displayed.avg)}
        subtitle={isFiltered ? "over filtered records" : "over all records"}
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
      <SummaryCard
        label={isFiltered ? "Filtered Pending" : "Pending"}
        value={displayed.pending}
        subtitle={isFiltered ? "awaiting decision in filtered set" : "awaiting decision (no valid RTN/CR #)"}
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
      <SummaryCard
        label="Duplicate Pairs"
        value={duplicateStats.duplicateRowCount.toLocaleString()}
        subtitle={`${duplicateStats.duplicatePairCount.toLocaleString()} invoice+item combos`}
        loading={showSkeletons}
        Skeleton={Skeleton}
      />
    </section>
  );
}
