export const Th = ({ children }) => (
  <th
    style={{
      textAlign: "left",
      padding: "0.6rem 0.75rem",
      fontWeight: 500,
      color: "#9ca3af",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);

export const Td = ({ children, style }) => (
  <td
    style={{
      padding: "0.6rem 0.75rem",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </td>
);
