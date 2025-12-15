import { memo } from "react";
import type { CsvPreview, PushState } from "../../types";

const TEXT = {
  smallMuted: {
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
  bodyMuted: {
    fontSize: "0.9rem",
    color: "#8ea2c6",
  },
};

interface CsvPreviewTableProps {
  rows: Record<string, any>[];
}

function CsvPreviewTable({ rows }: CsvPreviewTableProps) {
  return (
    <div
      className="panel"
      style={{
        padding: "0.5rem",
        background: "rgba(8,12,24,0.6)",
        border: "1px solid rgba(122,242,255,0.18)",
      }}
    >
      <div
        style={{
          marginBottom: "0.3rem",
          color: "#e5e7eb",
          fontWeight: 600,
        }}
      >
        Preview sample (first 5 rows)
      </div>
      <div style={{ maxHeight: 220, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.78rem",
            color: "#e5e7eb",
          }}
        >
          <thead>
            <tr>
              {[
                "Invoice Number",
                "Item Number",
                "Customer Number",
                "Credit Type",
                "Sales Rep",
                "QTY",
                "RTN_CR_No",
                "id",
                "combo_key",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.25rem 0.35rem",
                    color: "#9ca3af",
                    borderBottom: "1px solid #111827",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, idx) => (
              <tr
                key={`csv-preview-${idx}`}
                style={{
                  background:
                    idx % 2 === 0 ? "#0b1224" : "#0f172a",
                }}
              >
                {[
                  row["Invoice Number"],
                  row["Item Number"],
                  row["Customer Number"],
                  row["Credit Type"],
                  row["Sales Rep"],
                  row["QTY"],
                  row["RTN_CR_No"],
                  row.id || row.Id || row.ID || "",
                  row.combo_key || "",
                ].map((cell, i) => (
                  <td
                    key={i}
                    style={{
                      padding: "0.25rem 0.35rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MemoizedCsvPreviewTable = memo(CsvPreviewTable);

interface CsvDiffViewProps {
  diffEntries: Array<{
    id: string;
    combo: string;
    changed: Record<string, { from: any; to: any }>;
  }>;
}

function CsvDiffView({ diffEntries }: CsvDiffViewProps) {
  return (
    <div
      className="panel"
      style={{
        padding: "0.6rem",
        background: "rgba(14,20,35,0.7)",
        border: "1px solid rgba(123,255,181,0.25)",
        borderRadius: "0.7rem",
      }}
    >
      <div
        style={{
          marginBottom: "0.35rem",
          color: "#e5e7eb",
          fontWeight: 700,
        }}
      >
        Changed fields preview (up to 10 rows)
      </div>
      <div
        style={{
          maxHeight: 200,
          overflow: "auto",
          fontSize: "0.8rem",
          color: TEXT.smallMuted.color,
        }}
      >
        {diffEntries.slice(0, 10).map((entry, idx) => (
          <div
            key={`diff-${idx}`}
            style={{
              padding: "0.35rem 0.45rem",
              borderBottom: "1px solid #111827",
            }}
          >
            <div
              style={{
                color: "#c5d2f0",
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              {entry.combo || entry.id || "row"} —{" "}
              {Object.keys(entry.changed).length} field(s)
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {Object.entries(entry.changed).map(
                ([field, diff]) => (
                  <div
                    key={field}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "#9ca3af",
                        minWidth: 140,
                      }}
                    >
                      {field}
                    </span>
                    <span style={{ color: "#fca5a5" }}>
                      {String(diff.from ?? "—")}
                    </span>
                    <span style={{ color: "#6ee7b7" }}>
                      → {String(diff.to ?? "—")}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MemoizedCsvDiffView = memo(CsvDiffView);

interface CsvIssuesListProps {
  issues: string[];
}

function CsvIssuesList({ issues }: CsvIssuesListProps) {
  return (
    <div
      style={{
        padding: "0.5rem 0.75rem",
        borderRadius: "0.55rem",
        border: "1px solid rgba(248,113,113,0.4)",
        background: "rgba(248,113,113,0.08)",
        color: "#fecdd3",
        fontSize: "0.85rem",
        maxHeight: 160,
        overflow: "auto",
      }}
    >
      <strong>Issues:</strong>
      <ul
        style={{
          margin: "0.25rem 0 0 1rem",
          padding: 0,
        }}
      >
        {issues.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

const MemoizedCsvIssuesList = memo(CsvIssuesList);

export interface CsvUploadSectionProps {
  csvPushFile: File | null;
  onCsvFileChange: (file: File | null) => void;
  onCsvPreview: () => void;
  csvPreview: CsvPreview;
  csvPushState: PushState;
}

const CsvUploadSection = memo<CsvUploadSectionProps>(function CsvUploadSection({
  csvPushFile,
  onCsvFileChange,
  onCsvPreview,
  csvPreview,
  csvPushState,
}) {

  return (
    <section className="panel" style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <label
          className="upload-csv-btn"
          style={{
            position: "relative",
            overflow: "hidden",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 10,
            padding: "0.7rem 1.1rem",
            borderRadius: "1rem",
            border: "1px solid rgba(125,247,200,0.5)",
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.16), rgba(59,130,246,0.14))",
            color: "#d1fae5",
            cursor: "pointer",
            boxShadow: "0 16px 36px rgba(16,185,129,0.22)",
            minWidth: 180,
          }}
        >
          <input
            type="file"
            accept=".csv"
            onChange={(e) =>
              onCsvFileChange(e.target.files?.[0] || null)
            }
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
            }}
          />
          <span style={{ fontWeight: 600 }}>Upload CSV</span>
          {csvPushFile?.name && (
            <span
              style={{
                ...TEXT.smallMuted,
                color: "#9ca3af",
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {csvPushFile.name}
            </span>
          )}
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={csvPushState.loading}
          onClick={onCsvPreview}
        >
          {csvPushState.loading ? "Processing..." : "Preview CSV"}
        </button>
        <span style={TEXT.smallMuted}>
          Push to Firebase applies the previewed CSV.
        </span>
      </div>

      {csvPreview.summary && (
        <div
          style={{
            marginTop: "0.5rem",
            display: "grid",
            gap: 4,
            ...TEXT.smallMuted,
          }}
        >
          <div style={{ color: "#c5d2f0" }}>
            Preview: {csvPreview.summary.total} rows ·{" "}
            {csvPreview.summary.updates} updates ·{" "}
            {csvPreview.summary.inserts} inserts
          </div>

          {csvPreview.rows.length > 0 && (
            <MemoizedCsvPreviewTable rows={csvPreview.rows} />
          )}

          {csvPreview.diffEntries &&
            csvPreview.diffEntries.length > 0 && (
            <MemoizedCsvDiffView diffEntries={csvPreview.diffEntries} />
          )}

          {csvPreview.issues.length > 0 && (
            <MemoizedCsvIssuesList issues={csvPreview.issues} />
          )}
        </div>
      )}

      {(csvPushState.message || csvPushState.error) && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.55rem",
            border: csvPushState.error
              ? "1px solid rgba(248,113,113,0.4)"
              : "1px solid rgba(34,197,94,0.35)",
            background: csvPushState.error
              ? "rgba(248,113,113,0.08)"
              : "rgba(34,197,94,0.08)",
            color: csvPushState.error ? "#fecdd3" : "#86efac",
            fontSize: "0.85rem",
          }}
        >
          {csvPushState.error || csvPushState.message}
        </div>
      )}
    </section>
  );
});

export default CsvUploadSection;
