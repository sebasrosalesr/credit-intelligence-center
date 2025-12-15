export default function FiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  bulkList,
  onBulkListChange,
  onExportCsv,
  onExportPdf,
}) {
  return (
    <section className="filters-row">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange?.(e.target.value)}
        placeholder="Search by invoice, item, ticket, customer, RTN, reason..."
        className="input"
        style={{ flex: "1 1 260px" }}
      />
      <select value={statusFilter} onChange={(e) => onStatusFilterChange?.(e.target.value)} className="select">
        {["All", "Pending", "Completed"].map((opt) => (
          <option key={opt} value={opt}>
            Status: {opt}
          </option>
        ))}
      </select>
      <button type="button" onClick={onExportCsv} className="btn btn-ghost">
        Export CSV (filtered)
      </button>
      <button type="button" onClick={onExportPdf} className="btn btn-primary">
        Export PDF summary
      </button>
      <div style={{ flex: "1 1 240px", minWidth: "240px" }} className="neo-textarea-wrapper">
        <textarea
          value={bulkList}
          onChange={(e) => onBulkListChange?.(e.target.value)}
          placeholder="Paste invoice/item/ticket list (comma, space, or newline separated)"
          rows={2}
          className="neo-textarea"
        />
      </div>
    </section>
  );
}
