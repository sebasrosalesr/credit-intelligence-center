export function getAccountGroup(customerNumber) {
  const raw = String(customerNumber || "").trim();
  if (!raw) return "Unknown";
  if (raw.length <= 3) return raw;
  return raw.slice(0, 3);
}
