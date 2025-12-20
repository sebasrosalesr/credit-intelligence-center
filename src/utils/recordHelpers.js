export function getWorkflowState(rec) {
  const v = rec?.RTN_CR_No;
  if (!v || v === "nan" || v === "" || v === null || v === undefined) {
    return "Pending";
  }
  return "Completed";
}

export function extractLatestStatusLabel(raw, { maxLength = 60 } = {}) {
  if (!raw) return "";

  const str = String(raw);
  const matches = str.match(
    /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\][^\n\r]*/g
  );

  let line;
  if (matches && matches.length > 0) {
    line = matches[matches.length - 1].trim();
    line = line.replace(/^\[[^\]]+\]\s*/, "");
  } else {
    line = str.trim();
  }

  if (maxLength && line.length > maxLength) {
    const sliceAt = Math.max(0, maxLength - 3);
    return line.slice(0, sliceAt) + "…";
  }
  return line;
}

export function parseStatusTimeline(raw) {
  if (!raw) return [];
  const str = String(raw);

  const matches = str.match(
    /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\][^\n\r]*/g
  );
  if (!matches) return [];

  return matches
    .map((line) => {
      const trimmed = line.trim();
      const tsMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (!tsMatch) {
        return { timestamp: "", label: trimmed };
      }
      return { timestamp: tsMatch[1], label: tsMatch[2] };
    })
    .filter((entry) => {
      if (!entry) return false;
      const text = (entry.label || "").toLowerCase();
      if (text.startsWith("reminder completed")) return false;
      if (text.startsWith("reminder snoozed")) return false;
      return true;
    });
}

export function computeAging(rec) {
  if (!rec?.Date) return { daysSinceCreated: null, daysPending: null };

  const created = new Date(rec.Date);
  if (Number.isNaN(created.getTime())) {
    return { daysSinceCreated: null, daysPending: null };
  }

  const now = new Date();
  const diffMs = now - created;
  const daysSinceCreated = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const state = getWorkflowState(rec);
  const daysPending = state === "Pending" ? daysSinceCreated : 0;

  return { daysSinceCreated, daysPending };
}

export function getReminderKey(rec, reminder) {
  const r = reminder || rec?.__reminder || {};
  if (r.firebaseKey) return r.firebaseKey;
  if (r.id) return r.id;
  if (r.alert_id) return r.alert_id;
  if (rec?.alert_id) return rec.alert_id;
  if (rec?.id) return rec.id;
  return null;
}

export function getReminderTicketKey(source) {
  const fallbackFields = [
    "ticket_number",
    "ticketNumber",
    "ticket",
    "ticket_id",
    "ticketId",
    "ticket_ref",
    "ticketRef",
  ];

  if (!source) return null;
  for (const key of fallbackFields) {
    const value = source?.[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  const alt = source?.["Ticket Number"] ?? source?.["TicketNumber"];
  if (alt != null && String(alt).trim() !== "") return String(alt).trim();
  return null;
}

export function getStrictReminderTicketKey(source) {
  const candidate =
    source?.["Ticket Number"] ??
    source?.ticket_number ??
    source?.ticket ??
    null;

  if (!candidate) return null;
  const trimmed = String(candidate).trim();
  return trimmed && trimmed.toLowerCase() !== "nan" ? trimmed : null;
}
