import FiltersBar from "../common/FiltersBar.jsx";
import SummaryStrip from "../common/SummaryStrip.jsx";
import ChartsSection from "../common/ChartsSection.jsx";
import CreditsTable from "../table/CreditsTable.jsx";
import LargestCreditsTable from "../dashboard/LargestCreditsTable.jsx";

export default function DashboardTab({
  // filters
  search,
  statusFilter,
  bulkList,
  onSearchChange,
  onStatusFilterChange,
  onBulkListChange,
  onExportCsv,
  onExportPdf,

  // records + sorting
  totalRecords,
  visibleRecords,
  sortBy,
  sortDir,
  onSort,
  onScroll,

  // selection + editing passthrough
  selectedRowKeys,
  onToggleSelectAll,
  onToggleRow,
  pendingEdits,
  onEditField,

  // metrics / analytics
  summary,
  filteredSummary,
  isFiltered,
  duplicateStats,
  dailySummary,
  analyticsReady,
  analytics,
  showSummarySkeletons,
  isRemoteLoading,
  riskIndex,
  topCredits = [],

  // helpers
  getRecordKey,
  getWorkflowState,
  extractLatestStatusLabel,
  formatCurrency,

  // options
  salesRepOptions,
  creditTypeOptions,

  // interactions
  onRowClick,

  Skeleton,
}) {


  return (
    <>
      <FiltersBar
        search={search}
        onSearchChange={onSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        bulkList={bulkList}
        onBulkListChange={onBulkListChange}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
      />

      <SummaryStrip
        summary={summary}
        filteredSummary={filteredSummary}
        isFiltered={isFiltered}
        duplicateStats={duplicateStats}
        showSkeletons={showSummarySkeletons}
        formatCurrency={formatCurrency}
        riskIndex={riskIndex}
        Skeleton={Skeleton}
      />

      <section className="panel panel-muted" style={{ marginBottom: "1.5rem" }}>
        <strong style={{ color: "#e9eefb" }}>📈 Daily summary:</strong>{" "}
        <span style={{ color: "#c5d2f0" }}>{dailySummary}</span>
      </section>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "60vh",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {visibleRecords.length === 0 ? (
          <section
            className="panel"
            style={{
              marginTop: "0.75rem",
              padding: "1.5rem",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            No records match the current filters.
          </section>
        ) : (
          <CreditsTable
            totalRecords={totalRecords}
            visibleRecords={visibleRecords}
            allowEdit={false}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={onSort}
            onScroll={onScroll}
            onRowClick={onRowClick}
            selectedRowKeys={selectedRowKeys}
            onToggleSelectAll={onToggleSelectAll}
            onToggleRow={onToggleRow}
            pendingEdits={pendingEdits}
            onEditField={onEditField}
            getRecordKey={getRecordKey}
            getWorkflowState={getWorkflowState}
            extractLatestStatusLabel={extractLatestStatusLabel}
            formatCurrency={formatCurrency}
            duplicateCombos={duplicateStats.duplicateCombos}
            topSpacer="0.75rem"
            height="calc(100vh - 280px)"
            salesRepOptions={salesRepOptions}
            creditTypeOptions={creditTypeOptions}
          />
        )}
      </div>

      <ChartsSection
        analyticsReady={analyticsReady}
        isRemoteLoading={isRemoteLoading}
        analytics={analytics}
        formatCurrency={formatCurrency}
      />

      <LargestCreditsTable
        analytics={analytics}
        topCredits={topCredits}
        formatCurrency={formatCurrency}
      />
    </>
  );
}
