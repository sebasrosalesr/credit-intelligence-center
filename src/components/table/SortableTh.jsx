export default function SortableTh({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "0.65rem 0.85rem",
        fontWeight: 500,
        color: active ? "#e5e9f5" : "#9aa5b9",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
