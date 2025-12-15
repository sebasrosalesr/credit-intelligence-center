export default function SlaPill({ badge }) {
  if (!badge) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0.15rem 0.55rem",
        borderRadius: "999px",
        background: badge.bg,
        color: badge.color,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "999px",
          background: badge.color,
        }}
      />
      {badge.label}
    </span>
  );
}
