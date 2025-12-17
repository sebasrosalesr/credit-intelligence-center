import { useCallback, useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import StatusPill from "./table/StatusPill.jsx";
import InvestigationNotesModal from "./InvestigationNotesModal";
import InvestigationNotesSection from "./InvestigationNotesSection";
import { formatCurrency } from "../utils/format";
import {
  reminderPanelAccent,
  reminderPanelGlow,
  reminderPanelStyle,
  reminderGhostIconButton,
  reminderOverlayStyle,
} from "./modalStyles.js";
import {
  computeAging,
  extractLatestStatusLabel,
  getWorkflowState,
  parseStatusTimeline,
} from "../utils/recordHelpers";

function deriveSnoozeIso(reminder) {
  if (!reminder?.snoozed_until) return "";
  const dt = new Date(reminder.snoozed_until);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 16);
}

const TEXT = {
  displayTitle: {
    fontSize: "1.8rem",
    fontWeight: 720,
    letterSpacing: "0.02em",
  },
  bodyMuted: {
    fontSize: "0.9rem",
    color: "#8ea2c6",
  },
  panelHeading: {
    fontSize: "0.95rem",
    color: "#e5e7eb",
  },
  smallMuted: {
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
};

const pillBtn = {
  height: 44,
  borderRadius: 999,
  padding: "0 14px",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  overflow: "visible",
  transform: "translateZ(0)",
  backfaceVisibility: "hidden",
};

const pillBtnText = {
  display: "block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: 1.15,
  paddingLeft: 2,
  WebkitFontSmoothing: "antialiased",
  textRendering: "geometricPrecision",
};
export default function DetailDrawer({
  rec,
  onClose,
  onAddStatusUpdate,
  onCompleteReminder,
  onSnoozeReminder,
  dbInstance,
  readOnly = false,
}) {
  const state = getWorkflowState(rec);
  const { daysSinceCreated, daysPending } = computeAging(rec);
  const timeline = parseStatusTimeline(rec.Status);
  const reminder = rec.__reminder || null;
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [applyAll, setApplyAll] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const reminderStatus = reminder?.status || (reminder ? "pending" : null);
  const isCompleted = reminderStatus === "completed";
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [investigationNotes, setInvestigationNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const effectiveNotesLoading = dbInstance ? notesLoading : false;
  const effectiveNotesError = dbInstance ? notesError : "No Firebase connection.";
  const effectiveInvestigationNotes = dbInstance ? investigationNotes : [];
  const hasInvestigationNotes = investigationNotes.length > 0;
  const comboKey =
    rec?.["Invoice Number"] && rec?.["Item Number"]
      ? `${rec["Invoice Number"]}|${rec["Item Number"]}`
      : null;

  useEffect(() => {
    const shouldLock = showInvestigationModal || notesModalOpen;
    const prevOverflow = document.body.style.overflow;
    if (shouldLock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [showInvestigationModal, notesModalOpen]);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 10);
    return () => clearTimeout(t);
  }, []);

  const fetchInvestigationNotes = useCallback(
    async (cancelToken) => {
      if (!dbInstance) return;
      const notesRef = ref(dbInstance, "investigation_notes");
      const filterLocal = (obj) => {
        const list = Object.values(obj || {});
        return list.filter((note) => {
          if (!note) return false;
          if (!comboKey) return true;
          return note.combo_key === comboKey;
        });
      };

      const sortNotes = (notes) =>
        [...notes].sort((a, b) => {
          const aTs = Date.parse(a.updated_at || a.created_at || "") || 0;
          const bTs = Date.parse(b.updated_at || b.created_at || "") || 0;
          return bTs - aTs;
        });

      setNotesLoading(true);
      setNotesError("");
      setInvestigationNotes([]);

      try {
        const snap = await get(notesRef);
        if (cancelToken.cancelled) return;
        const val = snap.val();
        const result = val ? filterLocal(val) : [];
        if (cancelToken.cancelled) return;
        setInvestigationNotes(sortNotes(result));
        setNotesLoading(false);
        setNotesError("");
      } catch (err) {
        console.error("Failed to load investigation notes:", err);
        if (cancelToken.cancelled) return;
        setInvestigationNotes([]);
        setNotesLoading(false);
        setNotesError("Failed to load investigation notes.");
      }
    },
    [dbInstance, comboKey]
  );

  useEffect(() => {
    if (!rec || !dbInstance) return;
    const cancelToken = { cancelled: false };
    const timeoutId = setTimeout(() => fetchInvestigationNotes(cancelToken), 0);
    return () => {
      cancelToken.cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [rec, dbInstance, fetchInvestigationNotes]);

  const buildReadableTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDetailDrawerReminderKey = () =>
    rec?.__actionKey ||
    reminder?.firebaseKey ||
    reminder?.alert_id ||
    reminder?.id ||
    null;

  const handleMarkReminderDone = async () => {
    if (!reminder) return;
    const readableTs = buildReadableTimestamp();
    const actionKey = getDetailDrawerReminderKey();
    if (!actionKey) return;

    const completedReminder = {
      ...reminder,
      status: "completed",
      completed_at: readableTs,
      firebaseKey: actionKey,
      alert_id: actionKey,
      id: actionKey,
    };

    onCompleteReminder?.({
      ...rec,
      __actionKey: actionKey,
      __reminder: completedReminder,
    });
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  return (
    <div
      className={`drawer-overlay ${open ? "show" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 40,
      }}
      onClick={handleClose}
    >
      <div
        className={`drawer-panel ${open ? "show" : ""}`}
        style={{
          width: "420px",
          maxWidth: "100%",
          height: "100%",
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-surface panel" style={{ padding: "1rem 1.1rem 1.2rem" }}>
          <div className="drawer-header">
            <div>
              <h2
                style={{
                  margin: 0,
                  ...TEXT.displayTitle,
                  fontSize: "1.25rem",
                  fontWeight: 650,
                }}
              >
                Ticket {rec["Ticket Number"] || "—"}
              </h2>
              <div
                style={{
                  marginTop: 4,
                  ...TEXT.bodyMuted,
                  color: "#9ca3af",
                }}
              >
                Invoice {rec["Invoice Number"] || "—"} · Item {rec["Item Number"] || "—"}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <StatusPill state={state} label={extractLatestStatusLabel(rec.Status)} />
                <span className="chip chip-ghost" style={{ fontSize: "0.95rem", padding: "0.4rem 0.75rem" }}>
                  {formatCurrency(rec["Credit Request Total"])}
                </span>
              </div>
            </div>
            <button type="button" onClick={handleClose} className="drawer-close">
              ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              onClick={() => setShowInvestigationModal(true)}
              disabled={readOnly}
              style={{
                ...pillBtn,
                border: "1px solid rgba(147,197,253,0.30)",
                background: "linear-gradient(145deg, rgba(37,99,235,0.22), rgba(6,10,22,0.62))",
                color: "#e9eefb",
                fontWeight: 700,
                cursor: readOnly ? "not-allowed" : "pointer",
                opacity: readOnly ? 0.65 : 1,
              }}
            >
              <span style={pillBtnText}>Add Investigation</span>
            </button>

            <button
              type="button"
              onClick={() => hasInvestigationNotes && setNotesModalOpen(true)}
              disabled={!hasInvestigationNotes}
              style={{
                ...pillBtn,
                border: "1px solid rgba(122,242,255,0.22)",
                borderColor: hasInvestigationNotes ? "rgba(56,189,248,0.7)" : "rgba(122,242,255,0.22)",
                background: "linear-gradient(145deg, rgba(12,16,34,0.72), rgba(6,10,22,0.62))",
                color: "#e9eefb",
                fontWeight: 700,
                opacity: hasInvestigationNotes ? 1 : 0.55,
                cursor: hasInvestigationNotes ? "pointer" : "not-allowed",
                boxShadow: hasInvestigationNotes
                  ? "0 0 20px rgba(34,197,94,0.35), inset 0 0 10px rgba(14,165,233,0.4)"
                  : "none",
              }}
            >
              <span style={pillBtnText}>View Investigation</span>
            </button>
          </div>

          <div
            style={{
              marginTop: "1rem",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: "1.25rem",
              rowGap: "0.4rem",
            }}
          >
            <DetailRow label="Customer #" value={rec["Customer Number"]} />
            <DetailRow label="Ticket #" value={rec["Ticket Number"]} />
            <DetailRow label="RTN/CR #" value={rec.RTN_CR_No || "—"} />
            <DetailRow label="Sales Rep" value={rec["Sales Rep"] || "—"} />
            <DetailRow label="Credit Type" value={rec["Credit Type"] || "—"} />
            <DetailRow label="Reason for Credit" value={rec["Reason for Credit"] || "—"} />
            <DetailRow label="Status" value={state} />
            <DetailRow label="Days Pending" value={daysPending != null ? `${daysPending}` : "n/a"} />
            <DetailRow label="Aging" value={daysSinceCreated != null ? `${daysSinceCreated} days since created` : "n/a"} />
            <DetailRow label="Requested By" value={rec["Requested By"] || "—"} />
          </div>

          {reminder && (
            <section style={{ marginTop: "0.9rem" }}>
              <div style={{ marginBottom: 4, ...TEXT.smallMuted }}>Reminder</div>
              <div
                style={{
                  padding: "0.85rem 1rem 0.95rem",
                  borderRadius: "1rem",
                  border: "1px solid rgba(148,163,184,0.35)",
                  background:
                    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.10), transparent 55%), rgba(15,23,42,0.96)",
                  boxShadow: "0 18px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 640,
                      letterSpacing: "0.03em",
                      fontSize: "0.94rem",
                    }}
                  >
                    {reminder.due_date || "No date"} {reminder.due_time ? `· ${reminder.due_time}` : ""}
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.2rem 0.65rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: isCompleted ? "#bbf7d0" : reminderStatus === "overdue" ? "#fecaca" : "#cbd5f5",
                      background: isCompleted
                        ? "rgba(22,163,74,0.18)"
                        : reminderStatus === "overdue"
                        ? "rgba(220,38,38,0.18)"
                        : "rgba(37,99,235,0.14)",
                    }}
                  >
                    {isCompleted ? "COMPLETED" : reminderStatus === "overdue" ? "OVERDUE" : "PENDING"}
                  </span>
                </div>

                {reminder.note && (
                  <div style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>{reminder.note}</div>
                )}

                {reminder.snoozed_until && !isCompleted && (
                  <div style={{ ...TEXT.smallMuted, color: "#cbd5f5" }}>
                    Snoozed until {new Date(reminder.snoozed_until).toLocaleString()}
                  </div>
                )}

                {isCompleted ? (
                  <div
                    style={{
                      marginTop: "0.15rem",
                      fontSize: "0.8rem",
                      color: "#9ca3af",
                    }}
                  >
                    Completed on {reminder.completed_at || "—"}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "0.1rem",
                      display: "grid",
                      gap: "0.45rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleMarkReminderDone}
                      style={{
                        padding: "0.42rem 1.15rem",
                        borderRadius: "999px",
                        border: "none",
                        background: "linear-gradient(145deg, rgba(34,197,94,0.95), rgba(45,212,191,0.9))",
                        color: "#020617",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 16px 34px rgba(16,185,129,0.55), 0 0 0 1px rgba(22,163,74,0.4)",
                        justifySelf: "flex-start",
                      }}
                    >
                      Mark as Done
                    </button>
                    <div style={{ display: "grid", gap: "0.4rem" }}>
                      <label
                        style={{
                          ...TEXT.smallMuted,
                          color: "#cbd5f5",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <span>Choose snooze until</span>
                        <input
                          type="datetime-local"
                          value={snoozeUntil || deriveSnoozeIso(reminder)}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setSnoozeUntil(e.target.value)}
                          style={{
                            padding: "0.55rem 0.65rem",
                            borderRadius: "0.65rem",
                            border: "1px solid rgba(148,163,184,0.45)",
                            background: "rgba(15,23,42,0.9)",
                            color: "#e5e7eb",
                          }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {[
                          { label: "In 1h", addMs: 1 * 3600 * 1000 },
                          { label: "In 3h", addMs: 3 * 3600 * 1000 },
                          { label: "Tomorrow 9:00", special: "tomorrow9" },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            className="chip chip-ghost"
                            onClick={() => {
                              const now = new Date();
                              let target;
                              if (opt.special === "tomorrow9") {
                                target = new Date(now);
                                target.setDate(now.getDate() + 1);
                                target.setHours(9, 0, 0, 0);
                              } else {
                                target = new Date(now.getTime() + opt.addMs);
                              }
                              setSnoozeUntil(target.toISOString().slice(0, 16));
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!snoozeUntil) return;
                          const dt = new Date(snoozeUntil);
                          if (Number.isNaN(dt.getTime()) || dt < new Date()) return;
                          if (onSnoozeReminder) {
                            const actionKey = getDetailDrawerReminderKey();
                            if (actionKey) {
                              onSnoozeReminder(
                                {
                                  ...rec,
                                  __actionKey: actionKey,
                                  __reminder: {
                                    ...(reminder || {}),
                                    alert_id: actionKey,
                                    id: actionKey,
                                    firebaseKey: actionKey,
                                  },
                                },
                                dt.toISOString()
                              );
                            }
                          }
                          setSnoozeUntil("");
                        }}
                        style={{
                          padding: "0.42rem 1.05rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(148,163,184,0.6)",
                          background: "rgba(15,23,42,0.98)",
                          color: "#e5e7eb",
                          fontSize: "0.86rem",
                          cursor: "pointer",
                          justifySelf: "flex-start",
                        }}
                      >
                        Apply Snooze
                      </button>
                      {reminder.snoozed_until && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSnoozeReminder) {
                              const actionKey = getDetailDrawerReminderKey();
                              if (actionKey) {
                                onSnoozeReminder(
                                  {
                                    ...rec,
                                    __actionKey: actionKey,
                                    __reminder: {
                                      ...(reminder || {}),
                                      alert_id: actionKey,
                                      id: actionKey,
                                      firebaseKey: actionKey,
                                    },
                                  },
                                  null
                                );
                              }
                            }
                            setSnoozeUntil("");
                          }}
                          style={{
                            padding: "0.42rem 1.05rem",
                            borderRadius: "999px",
                            border: "1px solid rgba(248,113,113,0.45)",
                            background: "rgba(15,23,42,0.9)",
                            color: "#fecdd3",
                            fontSize: "0.86rem",
                            cursor: "pointer",
                            justifySelf: "flex-start",
                          }}
                        >
                          Remove Snooze
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section style={{ marginTop: "0.75rem" }}>
            {/* Title */}
            <div
              style={{
                marginBottom: "0.45rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                ...TEXT.panelHeading,
                fontSize: "0.98rem",
              }}
            >
              <span role="img" aria-hidden="true">
                🪵
              </span>
              <span>Status Timeline</span>
            </div>

            {/* Input area */}
            {!readOnly ? (
              <>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Add a status update..."
                  className="textarea"
                  style={{
                    width: "100%",
                    minHeight: "70px",
                    resize: "vertical",
                  }}
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    ...TEXT.smallMuted,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={applyAll}
                    onChange={(e) => setApplyAll(e.target.checked)}
                  />
                  Apply to all rows with this ticket #
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const note = statusNote.trim();
                    if (!note) return;
                    setStatusSaving(true);
                    onAddStatusUpdate(rec, note, applyAll)
                      .then(() => setStatusNote(""))
                      .finally(() => setStatusSaving(false));
                  }}
                  className="btn btn-primary"
                  disabled={statusSaving}
                  style={{
                    width: "100%",
                    marginTop: "0.55rem",
                    borderRadius: "999px",
                    padding: "0.7rem 0.9rem",
                    fontWeight: 600,
                  }}
                >
                  {statusSaving ? "Saving..." : "Add Update"}
                </button>
              </>
            ) : (
              <div
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  borderRadius: "0.7rem",
                  border: "1px solid rgba(148, 163, 184, 0.35)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#9ca3af",
                  fontSize: "0.85rem",
                }}
              >
                Read-only access · status updates are disabled for your role.
              </div>
            )}

            {/* Scrollable timeline box */}
            <div
              style={{
                marginTop: "0.9rem",
                maxHeight: "230px",
                overflowY: "auto",
                padding: "0.6rem 0.55rem 0.6rem 0.7rem",
                borderRadius: "0.9rem",
                border: "1px solid rgba(148,163,184,0.22)",
                background:
                  "radial-gradient(circle at top, rgba(148,163,184,0.08), transparent 55%), rgba(15,23,42,0.94)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {timeline.length > 0 ? (
                timeline.map((t, idx) => (
                  <div key={idx} style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
                    <div
                      style={{
                        ...TEXT.smallMuted,
                        fontFamily:
                          'SF Mono, ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        marginBottom: 2,
                      }}
                    >
                      {t.timestamp || t.date || "n/a"}
                    </div>
                    <div
                      style={{
                        color: "#e5e7eb",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {t.label || t.status || "—"}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ ...TEXT.smallMuted }}>No timeline entries yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
      {showInvestigationModal && (
        <InvestigationNotesModal
          open={showInvestigationModal}
          onClose={() => setShowInvestigationModal(false)}
          credit={rec}
        />
      )}
      {notesModalOpen && (
        <div
          className="cic-modal-overlay"
          style={reminderOverlayStyle}
          onClick={() => setNotesModalOpen(false)}
        >
          <div
            className="cic-modal-panel"
            style={{
              ...reminderPanelStyle,
              width: "min(900px, 96vw)",
              maxWidth: "96vw",
              maxHeight: "92vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={reminderPanelAccent} />
            <div style={reminderPanelGlow} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setNotesModalOpen(false)}
                aria-label="Close investigation notes"
                style={reminderGhostIconButton}
              >
                ✕
              </button>
              <InvestigationNotesSection
                notes={effectiveInvestigationNotes}
                loading={effectiveNotesLoading}
                error={effectiveNotesError}
                hideToggle
                initialOpen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontSize: "0.8rem",
      }}
    >
      <span
        style={{
          ...TEXT.smallMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: "0.7rem",
        }}
      >
        {label}
      </span>
      <span style={{ color: "#e5e7eb", fontSize: "0.88rem" }}>
        {value || "—"}
      </span>
    </div>
  );
}
