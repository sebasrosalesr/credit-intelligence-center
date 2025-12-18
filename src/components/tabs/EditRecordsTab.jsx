// src/components/tabs/EditRecordsTab.jsx
import CreditsTable from "../table/CreditsTable.jsx";
import EditControls from "../edit/EditControls.tsx";
import CsvUploadSection from "../edit/CsvUploadSection.tsx";

const TEXT = {
  bodyMuted: {
    fontSize: "0.9rem",
    color: "#8ea2c6",
  },
  smallMuted: {
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
};

function EditRecordsTab({
  // filters
  search,
  statusFilter,
  bulkList,
  onSearchChange,
  onStatusFilterChange,
  onBulkListChange,
  onExportCsv,
  onExportPdf,

  // edit mode
  editMode,
  onToggleEditMode,
  pendingEdits,
  onClearPendingEdits,
  editUpsert,
  onEditUpsertChange,
  editPushState,
  canEditRecords = false,
  deleteState,
  csvPushState,
  ingestionSkipSummary,

  // CSV preview
  csvPushFile,
  onCsvFileChange,
  onCsvPreview,
  csvPreview,

  // deletion
  onDeleteSelected,
  selectedCount,
  hasDbConnection,

  // push
  onUnifiedPush,

  // table data & behavior
  totalRecords,
  visibleRecords,
  sortBy,
  sortDir,
  onSort,
  onScroll,
  selectedRowKeys,
  onToggleSelectAll,
  onToggleRow,
  onEditField,

  // helpers
  getRecordKey,
  getWorkflowState,
  extractLatestStatusLabel,
  formatCurrency,
  duplicateStats,
  salesRepOptions,
  creditTypeOptions,

  // interactions
  onRowClick,
}) {
  const hasCsvReady =
    csvPreview?.parsed &&
    csvPreview.rows &&
    csvPreview.rows.length > 0 &&
    (csvPreview.issues?.length ?? 0) === 0;

  return (
    <>
      {/* 🔍 Filters row */}
      <section className="filters-row">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by invoice, item, ticket, customer, RTN, reason..."
          className="input"
          style={{ flex: "1 1 260px" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="select"
        >
          {["All", "Pending", "Completed"].map((opt) => (
            <option key={opt} value={opt}>
              Status: {opt}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onExportCsv}
          className="btn btn-ghost"
        >
          Export CSV (filtered)
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          className="btn btn-primary"
        >
          Export PDF summary
        </button>
        <div style={{ flex: "1 1 240px", minWidth: "240px" }} className="neo-textarea-wrapper">
          <textarea
            value={bulkList}
            onChange={(e) => onBulkListChange(e.target.value)}
            placeholder="Paste invoice/item/ticket list (comma, space, or newline separated)"
            rows={2}
            className="neo-textarea"
          />
        </div>
      </section>
      {/* ℹ️ Inline hint */}
      <section
        className="panel panel-muted"
        style={{ marginBottom: "1rem", ...TEXT.bodyMuted }}
      >
        Inline edits stay local until you push via your CSV round-trip or the
        Push to Firebase button below.
      </section>

      <EditControls
        editMode={editMode}
        onToggleEditMode={onToggleEditMode}
        pendingEdits={pendingEdits}
        onClearPendingEdits={onClearPendingEdits}
        editUpsert={editUpsert}
        onEditUpsertChange={onEditUpsertChange}
        editPushState={editPushState}
        deleteState={deleteState}
        onDeleteSelected={onDeleteSelected}
        selectedCount={selectedCount}
        hasDbConnection={hasDbConnection}
        csvPushState={csvPushState}
        hasCsvReady={hasCsvReady}
        onUnifiedPush={onUnifiedPush}
        canEditRecords={canEditRecords}
        ingestionSkipSummary={ingestionSkipSummary}
      />
      <CsvUploadSection
        csvPushFile={csvPushFile}
        onCsvFileChange={onCsvFileChange}
        onCsvPreview={onCsvPreview}
        csvPreview={csvPreview}
        csvPushState={csvPushState}
      />

      {/* 🧮 Editable table */}
      <CreditsTable
        totalRecords={totalRecords}
        visibleRecords={visibleRecords}
        allowEdit={editMode && canEditRecords}
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
        duplicateCombos={duplicateStats?.duplicateCombos}
        topSpacer="1.25rem"
        height="calc(100vh - 360px)"
        salesRepOptions={salesRepOptions}
        creditTypeOptions={creditTypeOptions}
      />
    </>
  );
}

export default EditRecordsTab;
