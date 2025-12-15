export default function StatusPill({ state, label }) {
  let bg = "#1f2937";
  let color = "#e5e7eb";
  let cls = "status-pill";

  if (state === "Completed") {
    color = "#7bffb5";
    bg = "rgba(123, 255, 181, 0.12)";
    cls += " status-pill--completed";
  } else if (state === "Pending") {
    color = "#ffb347";
    bg = "rgba(255, 179, 71, 0.12)";
    cls += " status-pill--pending";
  }

  const text = label || state || "Unknown";

  return (
    <span title={text} className={cls} style={{ background: bg, color }}>
      <span className="status-dot" />
      {text}
    </span>
  );
}
