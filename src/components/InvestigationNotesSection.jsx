import { useState } from "react";

export default function InvestigationNotesSection({
  notes = [],
  loading = false,
  error = "",
  hideToggle = false,
  initialOpen = false,
}) {
  const [open, setOpen] = useState(initialOpen);
  const hasNotes = notes.length > 0;
  const subtitle =
    loading && !hasNotes
      ? "Fetching investigation notes…"
      : error
      ? error
      : hasNotes
      ? `${notes.length} note${notes.length === 1 ? "" : "s"} · ${
          notes[0]?.created_at || notes[0]?.updated_at || "Updated recently"
        }`
      : "No investigation notes yet";

  return (
    <section className="inv-modal">
      <div className="inv-modal-header">
        <div>
          <h2>Investigation Notes</h2>
          <p className="inv-subtitle">{subtitle}</p>
        </div>
        {!hideToggle && (
          <button
            type="button"
            className={`inv-toggle-btn${open ? " inv-toggle-btn--active" : ""}`}
            onClick={() => setOpen((prev) => !prev)}
            disabled={loading || Boolean(error)}
          >
            {loading
              ? "Loading notes…"
              : error
              ? "Notes unavailable"
              : open
              ? "Hide Investigation Notes"
              : "View Investigation Notes"}
          </button>
        )}
      </div>
      <div className={`inv-panel ${open ? "inv-panel--open" : ""}`}>
        <div className="inv-note-list">
          {loading && !hasNotes ? (
            <p className="inv-empty">Loading investigation notes…</p>
          ) : error ? (
            <p className="inv-empty">{error}</p>
          ) : hasNotes ? (
            notes.map((note) => (
              <article key={note.note_id || note.id} className="inv-item">
                <div
                  className="inv-text"
                  dangerouslySetInnerHTML={{
                    __html: note.body || note.text || "<p>—</p>",
                  }}
                />
                <span className="inv-meta">
                  {note.created_by || note.author || "Unknown"} ·{" "}
                  {note.created_at || note.updated_at || "—"}
                </span>
              </article>
            ))
          ) : (
            <p className="inv-empty">No investigation notes yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
