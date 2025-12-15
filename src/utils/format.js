export function toNumber(value) {
  if (value == null || value === "") return 0;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function formatTimeLeft(rem) {
  if (!rem?.due_date) return "No deadline";
  const due = new Date(`${rem.due_date}${rem.due_time ? `T${rem.due_time}` : ""}`);
  if (Number.isNaN(due.getTime())) return "Invalid deadline";
  const diff = due.getTime() - Date.now();
  const sign = diff >= 0 ? "" : "-";
  const abs = Math.abs(diff);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((abs / (1000 * 60)) % 60);
  return `${sign}${days}d ${hours}h ${mins}m`;
}

export function formatCurrency(value) {
  const n = toNumber(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
