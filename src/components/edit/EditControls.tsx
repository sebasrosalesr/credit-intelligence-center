import { memo } from "react";
import type { PushState } from "../../types";

const TEXT = {
  smallMuted: {
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
};

export interface EditControlsProps {
  editMode: boolean;
  onToggleEditMode: () => void;
  pendingEdits: Record<string, Record<string, any>>;
  onClearPendingEdits: () => void;
  editUpsert: boolean;
  onEditUpsertChange: (checked: boolean) => void;
  editPushState: PushState;
  deleteState: PushState;
  onDeleteSelected: () => void;
  selectedCount: number;
  hasDbConnection: boolean;
  csvPushState: PushState;
  hasCsvReady: boolean;
  onUnifiedPush: () => void;
  canEditRecords: boolean;
  ingestionSkipSummary?: { count: number; fields: string[] };
}

const EditControls = memo<EditControlsProps>(function EditControls({
  editMode,
  onToggleEditMode,
  pendingEdits: _pendingEdits,
  onClearPendingEdits,
  editUpsert,
  onEditUpsertChange,
  editPushState,
  deleteState,
  onDeleteSelected,
  selectedCount,
  hasDbConnection,
  csvPushState,
  hasCsvReady,
  onUnifiedPush,
  canEditRecords,
  ingestionSkipSummary,
}) {
  const skipSummary = ingestionSkipSummary;

  if (!canEditRecords) {
    return (
      <section className="panel panel-muted" style={{ marginBottom: "1rem" }}>
        <div style={{ color: "#9ca3af" }}>
          Read-only access · editing, delete, and push controls are disabled for your role.
        </div>
      </section>
    );
  }

  return (
    <section className="panel" style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={onToggleEditMode}
          >
            {editMode ? "Editing enabled" : "Enable editing"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClearPendingEdits}
          >
            Clear pending edits
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={deleteState.loading || selectedCount === 0 || !hasDbConnection}
            onClick={onDeleteSelected}
          >
            {deleteState.loading
              ? "Deleting…"
              : `Delete selected (${selectedCount || 0})`}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...TEXT.smallMuted,
            }}
          >
            <input
              type="checkbox"
              checked={editUpsert}
              onChange={(e) => onEditUpsertChange(e.target.checked)}
            />
            Upsert using id/combo_key
          </label>
          {(editUpsert || hasCsvReady) && (
            <span
              style={{
                ...TEXT.smallMuted,
                color: hasCsvReady ? "#9ff3c8" : "#9ca3af",
              }}
            >
              Push mode: {hasCsvReady ? "CSV preview" : "Pending edits"}
            </span>
          )}
          <button
            type="button"
            className="btn"
            style={{
              borderRadius: "999px",
              border: "1px solid rgba(125, 247, 200, 0.6)",
              background: "rgba(125, 247, 200, 0.12)",
              color: "#9ff3c8",
              boxShadow: "0 10px 30px rgba(125,247,200,0.18)",
            }}
            disabled={editPushState.loading || csvPushState.loading}
            onClick={onUnifiedPush}
          >
            {editPushState.loading || csvPushState.loading
              ? "Pushing…"
              : "Push to Firebase"}
          </button>
        </div>
      </div>

      {editMode && skipSummary && skipSummary.count > 0 && (
        <div
          style={{
            marginTop: "0.6rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.55rem",
            border: "1px solid rgba(251,191,36,0.25)",
            background: "rgba(251,191,36,0.08)",
            color: "rgba(251,191,36,0.95)",
            fontSize: "0.85rem",
          }}
        >
          Backend ingestion will skip {skipSummary.count} edited row(s) missing:{" "}
          {(skipSummary.fields || []).join(", ") || "required fields"}.
        </div>
      )}

      {(editPushState.message || editPushState.error) && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.55rem",
            border: editPushState.error
              ? "1px solid rgba(248,113,113,0.4)"
              : "1px solid rgba(34,197,94,0.35)",
            background: editPushState.error
              ? "rgba(248,113,113,0.08)"
              : "rgba(34,197,94,0.08)",
            color: editPushState.error ? "#fecdd3" : "#86efac",
            fontSize: "0.85rem",
          }}
        >
          {editPushState.error || editPushState.message}
        </div>
      )}

      {(deleteState.message || deleteState.error) && (
        <div
          style={{
            marginTop: "0.4rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.55rem",
            border: deleteState.error
              ? "1px solid rgba(248,113,113,0.4)"
              : "1px solid rgba(34,197,94,0.35)",
            background: deleteState.error
              ? "rgba(248,113,113,0.08)"
              : "rgba(34,197,94,0.08)",
            color: deleteState.error ? "#fecdd3" : "#86efac",
            fontSize: "0.85rem",
          }}
        >
          {deleteState.error || deleteState.message}
        </div>
      )}
    </section>
  );
});

export default EditControls;
