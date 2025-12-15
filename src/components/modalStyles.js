export const reminderOverlayStyle = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.22), transparent 35%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.18), transparent 28%), rgba(2,6,23,0.86)",
  backdropFilter: "blur(14px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "1.25rem",
};

export const reminderPanelStyle = {
  width: "460px",
  maxWidth: "96vw",
  background: "linear-gradient(145deg, rgba(10,12,26,0.95), rgba(3,6,18,0.94))",
  border: "1px solid rgba(59,130,246,0.35)",
  boxShadow:
    "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 18px 40px rgba(59,130,246,0.18)",
  borderRadius: "1.05rem",
  padding: "1.25rem",
  position: "relative",
  overflow: "hidden",
};

export const reminderPanelAccent = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(circle at 15% 10%, rgba(99,102,241,0.08), transparent 35%), radial-gradient(circle at 85% 20%, rgba(34,211,238,0.08), transparent 32%)",
  pointerEvents: "none",
  zIndex: 0,
};

export const reminderPanelGlow = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "3px",
  background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(16,185,129,0.85), rgba(124,58,237,0.9))",
  pointerEvents: "none",
  zIndex: 0,
};

export const reminderGhostIconButton = {
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#e5e7eb",
  padding: "0.35rem 0.7rem",
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
};
