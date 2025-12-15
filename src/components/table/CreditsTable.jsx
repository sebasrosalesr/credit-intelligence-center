import SortableTh from "./SortableTh.jsx";
import StatusPill from "./StatusPill.jsx";
import { Th, Td } from "../common/TableCells.jsx";

export default function CreditsTable({
  totalRecords,
  visibleRecords,
  allowEdit,
  topSpacer = "0.75rem",
  height = "calc(100vh - 320px)",
  salesRepOptions = [],
  creditTypeOptions = [],
  sortBy,
  sortDir,
  onSort,
  onScroll,
  onRowClick,
  selectedRowKeys,
  onToggleSelectAll,
  onToggleRow,
  pendingEdits,
  onEditField,
  getRecordKey,
  getWorkflowState,
  extractLatestStatusLabel,
  formatCurrency,
  duplicateCombos,
}) {
  const truncate = (value, max = 30) => {
    if (!value) return "";
    const str = String(value);
    return str.length > max ? `${str.slice(0, max)}…` : str;
  };

  return (
    <section
      className="panel panel-table"
      style={{ padding: 0, marginBottom: "1.5rem", marginTop: topSpacer }}
    >
      <div className="panel-heading">
        <span>
          {totalRecords.toLocaleString()} records · showing {visibleRecords.length.toLocaleString()}
        </span>
        <span>Infinite scroll · Connected to Firebase RTDB</span>
      </div>

      <div
        className="credits-table-scroll"
        style={{
          maxHeight: height || "calc(100vh - 320px)",
          overflowY: "auto",
          overflowX: "auto",
          padding: "0 0.25rem 0.5rem",
          position: "relative",
        }}
        onScroll={onScroll}
      >
        <table
          className="data-table credits-table"
          style={{ minWidth: "1400px", borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "rgba(12, 16, 28, 0.96)",
              backdropFilter: "blur(3px)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
            }}
          >
            <tr>
              {allowEdit && (
                <th
                  style={{
                    width: 40,
                    background: "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      visibleRecords.length > 0 &&
                      visibleRecords.every((rec, idx) => selectedRowKeys.has(getRecordKey(rec, idx)))
                    }
                    onChange={(e) => {
                      if (!onToggleSelectAll) return;
                      onToggleSelectAll(e.target.checked);
                    }}
                  />
                </th>
              )}
              <SortableTh onClick={() => onSort("Date")} active={sortBy === "Date"} dir={sortDir}>
                Date
              </SortableTh>
              <Th>Status</Th>
              <SortableTh onClick={() => onSort("Customer")} active={sortBy === "Customer"} dir={sortDir}>
                Customer #
              </SortableTh>
              <SortableTh onClick={() => onSort("Invoice")} active={sortBy === "Invoice"} dir={sortDir}>
                Invoice #
              </SortableTh>
              <Th>Item #</Th>
              <Th>QTY</Th>
              <Th>Unit Price</Th>
              <Th>Corrected Unit Price</Th>
              <Th>Credit Type</Th>
              <SortableTh
                onClick={() => onSort("CreditTotal")}
                active={sortBy === "CreditTotal"}
                dir={sortDir}
              >
                Credit Request Total
              </SortableTh>
              <Th>Issue Type</Th>
              <Th>Reason for Credit</Th>
              <Th>Requested By</Th>
              <Th>EDI Service Provider</Th>
              <Th>Ticket #</Th>
              <Th>RTN/CR #</Th>
              <Th>Type</Th>
              <Th>Sales Rep</Th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((rec, idx) => {
              const state = getWorkflowState(rec);
              const comboKey =
                rec.combo_key ||
                (rec["Invoice Number"] && rec["Item Number"]
                  ? `${rec["Invoice Number"]}|${rec["Item Number"]}`
                  : null);
              const isDuplicatePair = comboKey && duplicateCombos?.has(comboKey);
              const key = getRecordKey(rec, idx);
              const editFor = pendingEdits[key] || {};
              const baseRowBg = idx % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)";
              const hoverBg = "var(--table-row-hover)";

              const handleField = (field, value) => {
                if (!onEditField) return;
                onEditField(key, field, value);
              };

              return (
                <tr
                  key={rec.id || `${rec["Invoice Number"]}-${idx}`}
                  style={{
                    cursor: "pointer",
                    background: baseRowBg,
                    transition: "background 140ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = baseRowBg)}
                  onClick={() => {
                    if (onRowClick && !allowEdit) onRowClick(rec, allowEdit);
                  }}
                >
                  {allowEdit && (
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.has(key)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (!onToggleRow) return;
                          onToggleRow(key, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Td>
                  )}
                  <Td>{rec.Date || ""}</Td>
                  <Td>
                    <StatusPill state={state} label={extractLatestStatusLabel(rec.Status)} />
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Customer Number"] ?? rec["Customer Number"] ?? ""}
                        onChange={(e) => handleField("Customer Number", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 120 }}
                      />
                    ) : (
                      rec["Customer Number"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Invoice Number"] ?? rec["Invoice Number"] ?? ""}
                        onChange={(e) => handleField("Invoice Number", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 120 }}
                      />
                    ) : (
                      rec["Invoice Number"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Item Number"] ?? rec["Item Number"] ?? ""}
                        onChange={(e) => handleField("Item Number", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 110 }}
                      />
                    ) : (
                      rec["Item Number"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor.QTY ?? rec.QTY ?? ""}
                        onChange={(e) => handleField("QTY", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 80 }}
                      />
                    ) : (
                      rec.QTY
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Unit Price"] ?? rec["Unit Price"] ?? ""}
                        onChange={(e) => handleField("Unit Price", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 110 }}
                      />
                    ) : (
                      formatCurrency(rec["Unit Price"])
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Corrected Unit Price"] ?? rec["Corrected Unit Price"] ?? ""}
                        onChange={(e) => handleField("Corrected Unit Price", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 140 }}
                      />
                    ) : (
                      formatCurrency(rec["Corrected Unit Price"])
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <select
                        value={editFor["Credit Type"] ?? rec["Credit Type"] ?? ""}
                        onChange={(e) => handleField("Credit Type", e.target.value)}
                        className="select"
                        style={{ minWidth: 120 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">(leave blank)</option>
                        {rec["Credit Type"] && !["Credit Memo", "Internal"].includes(rec["Credit Type"]) ? (
                          <option value={rec["Credit Type"]}>{`Keep: ${rec["Credit Type"]}`}</option>
                        ) : null}
                        {(creditTypeOptions.length ? creditTypeOptions : ["Credit Memo", "Internal"]).map((ct) => (
                          <option key={ct} value={ct}>
                            {ct}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rec["Credit Type"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Credit Request Total"] ?? rec["Credit Request Total"] ?? ""}
                        onChange={(e) => handleField("Credit Request Total", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 130 }}
                      />
                    ) : (
                      formatCurrency(rec["Credit Request Total"])
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Issue Type"] ?? rec["Issue Type"] ?? ""}
                        onChange={(e) => handleField("Issue Type", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 130 }}
                      />
                    ) : (
                      rec["Issue Type"]
                    )}
                  </Td>
                  <Td title={rec["Reason for Credit"]}>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Reason for Credit"] ?? rec["Reason for Credit"] ?? ""}
                        onChange={(e) => handleField("Reason for Credit", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 140 }}
                      />
                    ) : (
                      truncate(rec["Reason for Credit"])
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Requested By"] ?? rec["Requested By"] ?? ""}
                        onChange={(e) => handleField("Requested By", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 110 }}
                      />
                    ) : (
                      rec["Requested By"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["EDI Service Provider"] ?? rec["EDI Service Provider"] ?? ""}
                        onChange={(e) => handleField("EDI Service Provider", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 150 }}
                      />
                    ) : (
                      rec["EDI Service Provider"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor["Ticket Number"] ?? rec["Ticket Number"] ?? ""}
                        onChange={(e) => handleField("Ticket Number", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 110 }}
                      />
                    ) : (
                      rec["Ticket Number"]
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor.RTN_CR_No ?? rec.RTN_CR_No ?? ""}
                        onChange={(e) => handleField("RTN_CR_No", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 120 }}
                      />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {rec.RTN_CR_No && rec.RTN_CR_No !== "nan" && rec.RTN_CR_No !== "" ? rec.RTN_CR_No : "-"}
                        {isDuplicatePair && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#fca5a5",
                              border: "1px solid rgba(248,113,113,0.35)",
                              padding: "0.1rem 0.35rem",
                              borderRadius: 8,
                            }}
                          >
                            Duplicate
                          </span>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <input
                        className="input"
                        value={editFor.Type ?? rec.Type ?? ""}
                        onChange={(e) => handleField("Type", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 100 }}
                      />
                    ) : (
                      rec.Type
                    )}
                  </Td>
                  <Td>
                    {allowEdit ? (
                      <select
                        value={editFor["Sales Rep"] ?? rec["Sales Rep"] ?? ""}
                        onChange={(e) => handleField("Sales Rep", e.target.value)}
                        className="select"
                        style={{ minWidth: 110 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(salesRepOptions.length ? salesRepOptions : ["", "HOUSE"]).map((rep, i) => (
                          <option key={`${rep}-${i}`} value={rep}>
                            {rep || "—"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rec["Sales Rep"]
                    )}
                  </Td>
                </tr>
              );
            })}

            {visibleRecords.length === 0 && (
              <tr>
                <td
                  colSpan={allowEdit ? 19 : 18}
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No records match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
