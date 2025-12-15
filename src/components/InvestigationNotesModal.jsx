import { useEffect, useRef, useState, useCallback } from "react";
import { ref, push, set } from "firebase/database";
import { db } from "../firebase";

/**
 * Investigation notes modal.
 * Saves rich-text-ish HTML to Firebase under investigation_notes.
 */
export default function InvestigationNotesModal({ open, onClose, credit }) {
  const [isVisible, setIsVisible] = useState(open);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const editorRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);

  // Define credit-related variables early for useCallback dependencies
  const safeVal = (v) => (v == null || v === "" ? null : v);
  const ticket_number = safeVal(credit?.["Ticket Number"] || credit?.TicketNumber);
  const invoice_number = safeVal(credit?.["Invoice Number"]);
  const item_number = safeVal(credit?.["Item Number"]);
  const customer_number = safeVal(credit?.["Customer Number"]);
  const combo_key = invoice_number && item_number ? `${invoice_number}|${item_number}` : null;

  const hasBodyContent = useCallback(() => {
    const text = editorRef.current?.innerText || "";
    return text.trim().length > 0;
  }, []);

  const exec = useCallback((cmd) => {
    document.execCommand(cmd, false, null);
    const html = editorRef.current?.innerHTML || "";
    setBodyHtml(html);
    editorRef.current?.focus();
  }, []);

  // Generate unique draft key for localStorage
  const getDraftKey = useCallback(() => {
    const key = combo_key || ticket_number || invoice_number || `draft-${Date.now()}`;
    return `investigation-draft-${key}`;
  }, [combo_key, ticket_number, invoice_number]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    const draftKey = getDraftKey();
    try {
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.warn("Failed to clear draft:", err);
    }
  }, [getDraftKey]);

  const handleSave = useCallback(async () => {
    if (!db) {
      setError("No Firebase connection available.");
      return;
    }
    if (!hasBodyContent()) {
      setError("Please enter some investigation details.");
      return;
    }

    setSaving(true);
    setError("");
    const nowIso = new Date().toISOString();

    const notesRef = ref(db, "investigation_notes");
    const newRef = push(notesRef);
    const note_id = newRef.key;

    const noteData = {
      note_id,
      // context
      ticket_number,
      invoice_number,
      item_number,
      combo_key,
      customer_number,
      // content
      title: title || `Investigation for ${invoice_number || "unknown"} · ${item_number || ""}`,
      body: bodyHtml || "",
      // audit
      created_at: nowIso,
      created_by: "app",
      updated_at: nowIso,
      updated_by: "app",
    };

    try {
      await set(newRef, noteData);
      clearDraft(); // Clear draft on successful save
      onClose();
    } catch (err) {
      const msg =
        err?.code === "PERMISSION_DENIED"
          ? "Permission denied. Check Firebase rules for investigation_notes writes."
          : err?.message || "Failed to save note.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [hasBodyContent, title, bodyHtml, ticket_number, invoice_number, item_number, combo_key, customer_number, clearDraft, onClose]);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setSaving(false);
      setError("");
      setHasRestoredDraft(false);
      setShowDraftRestore(false);
      // Don't reset title/body here - let draft restoration handle it
      return undefined;
    }
    const t = setTimeout(() => setIsVisible(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  const shouldRender = isVisible && Boolean(credit);

  // Autosave functionality
  const saveDraft = useCallback((draftTitle, draftBody) => {
    if (!draftTitle.trim() && !draftBody.trim()) return;

    const draftKey = getDraftKey();
    const draft = {
      title: draftTitle,
      body: draftBody,
      timestamp: Date.now(),
      creditKey: combo_key || ticket_number || invoice_number
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (err) {
      console.warn("Failed to save draft:", err);
    }
  }, [getDraftKey, combo_key, ticket_number, invoice_number]);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    const draftKey = getDraftKey();
    try {
      const draftJson = localStorage.getItem(draftKey);
      if (draftJson) {
        const draft = JSON.parse(draftJson);
        return draft;
      }
    } catch (err) {
      console.warn("Failed to load draft:", err);
    }
    return null;
  }, [getDraftKey]);

  // Debounced autosave
  const debouncedAutosave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(() => {
      saveDraft(title, bodyHtml);
    }, 1000); // Save after 1 second of inactivity
  }, [title, bodyHtml, saveDraft]);

  // Load draft when modal opens
  useEffect(() => {
    if (open && !hasRestoredDraft) {
      const draft = loadDraft();
      if (draft && (draft.title.trim() || draft.body.trim())) {
        setShowDraftRestore(true);
      }
    }
  }, [open, hasRestoredDraft, loadDraft]);

  // Autosave when content changes
  useEffect(() => {
    if (open && hasRestoredDraft) {
      debouncedAutosave();
    }
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [title, bodyHtml, open, hasRestoredDraft, debouncedAutosave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open || showDraftRestore) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Formatting shortcuts
      if (cmdOrCtrl) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            exec('bold');
            break;
          case 'i':
            e.preventDefault();
            exec('italic');
            break;
          case 'u':
            e.preventDefault();
            exec('underline');
            break;
          case 'enter':
            e.preventDefault();
            if (!saving && hasBodyContent()) {
              handleSave();
            }
            break;
          default:
            break;
        }
      }

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, showDraftRestore, saving, hasBodyContent, handleSave, onClose, exec]);

  // Restore draft
  const handleRestoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setTitle(draft.title || "");
      setBodyHtml(draft.body || "");
      if (editorRef.current) {
        editorRef.current.innerHTML = draft.body || "";
      }
      setHasRestoredDraft(true);
    }
    setShowDraftRestore(false);
  };

  // Start fresh
  const handleStartFresh = () => {
    clearDraft();
    setHasRestoredDraft(true);
    setShowDraftRestore(false);
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`notes-modal-backdrop ${open ? "notes-modal-backdrop--open" : ""}`}
      onClick={onClose}
    >
      {/* Draft Restore Prompt */}
      {showDraftRestore && (
        <div
          className={`notes-modal-panel ${open ? "notes-modal-panel--open" : ""}`}
          style={{
            maxWidth: "480px",
            padding: "2rem",
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📝</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "#e5e7eb", fontSize: "1.25rem" }}>
              Found unsaved draft
            </h3>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.95rem" }}>
              We found a draft from your last session. Would you like to restore it?
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={handleStartFresh}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "0.55rem",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Start Fresh
            </button>
            <button
              type="button"
              onClick={handleRestoreDraft}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "0.55rem",
                border: "1px solid rgba(122,242,255,0.4)",
                background: "linear-gradient(120deg, rgba(122,242,255,0.2), rgba(77,226,197,0.18))",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              Restore Draft
            </button>
          </div>
        </div>
      )}

      {/* Main Modal */}
      {!showDraftRestore && (
        <div
          className={`notes-modal-panel ${open ? "notes-modal-panel--open" : ""}`}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
        <div className="notes-modal-header">
          <div className="notes-modal-title-block">
            <span className="notes-modal-pill">Investigation</span>
            <h2 className="notes-modal-title">{ticket_number || invoice_number || "Investigation Notes"}</h2>
            <p className="notes-modal-subtitle">Add and review investigation notes tied to this ticket / invoice.</p>
          </div>
          <button type="button" className="notes-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, marginBottom: 12 }}>
          {ticket_number && <span style={chipStyle}>Ticket: {ticket_number}</span>}
          {invoice_number && <span style={chipStyle}>Invoice: {invoice_number}</span>}
          {item_number && <span style={chipStyle}>Item: {item_number}</span>}
          {customer_number && <span style={chipStyle}>Customer: {customer_number}</span>}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Investigation summary title"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Investigation notes</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#6b7280" }}>
                <span>💾 Auto-saved</span>
                <span>•</span>
                <span>⌘+Enter to save</span>
              </div>
            </div>
            <div className="investigation-editor-shell" onClick={(e) => e.stopPropagation()}>
              <div className="investigation-toolbar">
                <button type="button" onClick={() => exec("bold")} className="investigation-toolbar__btn">
                  B
                </button>
                <button type="button" onClick={() => exec("italic")} className="investigation-toolbar__btn">
                  I
                </button>
                <button type="button" onClick={() => exec("underline")} className="investigation-toolbar__btn">
                  U
                </button>
                <button type="button" onClick={() => exec("insertUnorderedList")} className="investigation-toolbar__btn">
                  • List
                </button>
                <button type="button" onClick={() => exec("insertOrderedList")} className="investigation-toolbar__btn">
                  1. List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = "";
                      setBodyHtml("");
                      editorRef.current.focus();
                    }
                  }}
                  className="investigation-toolbar__btn"
                  title="Clear"
                >
                  Clear
                </button>
              </div>
              <div
                ref={editorRef}
                className="investigation-editor"
                contentEditable
                onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
                placeholder="Write investigation notes..."
                suppressContentEditableWarning
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.55rem",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasBodyContent()}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.55rem",
              border: "1px solid rgba(122,242,255,0.4)",
              background: "linear-gradient(120deg, rgba(122,242,255,0.2), rgba(77,226,197,0.18))",
              color: "#e5e7eb",
              cursor: "pointer",
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save investigation"}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 8, color: "#fca5a5", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}
        </div>
      )}
    </div>
  );
}

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.25rem 0.65rem",
  borderRadius: "999px",
  border: "1px solid rgba(122,242,255,0.25)",
  background: "rgba(122,242,255,0.08)",
  color: "#e5e7eb",
  fontSize: "0.8rem",
};

const inputStyle = {
  padding: "0.6rem 0.7rem",
  borderRadius: "0.6rem",
  border: "1px solid rgba(122,242,255,0.2)",
  background: "linear-gradient(145deg, rgba(18,27,52,0.95), rgba(10,17,36,0.92))",
  color: "#e5e7eb",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};
