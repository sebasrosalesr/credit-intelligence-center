import { useEffect, useMemo, useState, useCallback } from "react";
import { ref, onValue, Database } from "firebase/database";
import type { CreditRecord, ReminderRecord } from "../types";

// Temporary type for the utility function until we add proper types
type ReminderOrCredit = ReminderRecord | CreditRecord;
const getStrictReminderTicketKey = (item: ReminderOrCredit): string | null => {
  // This is a simplified version - in real implementation we'd import the actual function
  // and add proper TypeScript declarations to the utils
  if ('ticket_number' in item && item.ticket_number) {
    return String(item.ticket_number);
  }
  if ('ticket' in item && item.ticket) {
    return String(item.ticket);
  }
  if ('Ticket Number' in item && item['Ticket Number']) {
    return String(item['Ticket Number']);
  }
  return null;
};

export interface UseRemindersReturn {
  // State
  remindersMapByKey: Record<string, ReminderRecord>;
  reminderKeyByTicket: Record<string, string>;
  remindersLoaded: boolean;
  creditsWithReminders: CreditRecord[];

  // Operations
  cacheReminderSafe: (firebaseKey: string, reminder: ReminderRecord) => void;
}

/**
 * Custom hook for managing reminders data and operations
 * @param db - Firebase database instance
 * @param credits - Array of credit records
 * @param logClientEvent - Logging function
 * @returns Reminders state and operations
 */
export function useReminders(
  db: Database | null,
  credits: CreditRecord[] = [],
  _logClientEvent?: (event: any) => void
): UseRemindersReturn {
  const [remindersMapByKey, setRemindersMapByKey] = useState<Record<string, ReminderRecord>>({});
  const [reminderKeyByTicket, setReminderKeyByTicket] = useState<Record<string, string>>({});
  const [remindersLoaded, setRemindersLoaded] = useState<boolean>(false);

  // Firebase listener for reminders
  useEffect(() => {
    if (!db) {
      console.log('🔄 Reminders: No Firebase connection, clearing reminders');
      setRemindersMapByKey({});
      setReminderKeyByTicket({});
      setRemindersLoaded(false);
      return;
    }

    console.log('🔄 Reminders: Setting up Firebase listener for /reminders');
    const remindersRef = ref(db, "reminders");
    const unsubscribe = onValue(remindersRef, (snapshot) => {
      const raw = snapshot.val() || {};
      const byKey: Record<string, ReminderRecord> = {};
      const byTicket: Record<string, string> = {};
      let reminderCount = 0;

      Object.entries(raw).forEach(([firebaseKey, reminder]) => {
        if (!reminder) {
          console.warn(`⚠️ Reminders: Skipping null/undefined reminder at key ${firebaseKey}`);
          return;
        }
        const normalized: ReminderRecord = { ...reminder as ReminderRecord, firebaseKey };
        const ticketKey = getStrictReminderTicketKey(normalized);

        byKey[firebaseKey] = normalized;
        if (ticketKey) {
          byTicket[ticketKey] = firebaseKey;
        } else {
          console.warn(`⚠️ Reminders: Reminder ${firebaseKey} has no ticket_number or ticket field`, reminder);
        }
        reminderCount++;
      });

      console.log(`✅ Reminders: Loaded ${reminderCount} reminders (${Object.keys(byTicket).length} with tickets)`);
      console.log('🔍 Reminders: Sample reminders:', Object.values(byKey).slice(0, 3).map(r => ({
        id: r.id,
        status: r.status,
        ticket: r.ticket_number
      })));
      setRemindersMapByKey(byKey);
      setReminderKeyByTicket(byTicket);
      setRemindersLoaded(true);
    }, (error) => {
      console.error('❌ Reminders: Failed to load reminders from Firebase:', error);
      setRemindersMapByKey({});
      setReminderKeyByTicket({});
      setRemindersLoaded(false);
    });

    return () => {
      console.log('🔄 Reminders: Unsubscribing from Firebase listener');
      unsubscribe();
    };
  }, [db]);

  // Cache reminder operations
  const cacheReminderSafe = useCallback((firebaseKey: string, reminder: ReminderRecord) => {
    if (!firebaseKey) return;
    setRemindersMapByKey((prev) => ({
      ...(prev || {}),
      [firebaseKey]: reminder,
    }));
    const ticketKey = getStrictReminderTicketKey(reminder);
    if (ticketKey) {
      setReminderKeyByTicket((prev) => ({
        ...(prev || {}),
        [ticketKey]: firebaseKey,
      }));
    }
  }, []);

  // Credits with attached reminders
  const creditsWithReminders = useMemo<CreditRecord[]>(() => {
    console.log('🔄 Credits: Processing', credits.length, 'credit records');
    let remindersAttached = 0;
    let fallbackRemindersAttached = 0;

    const result = credits.map((rec) => {
      const ticketKey = getStrictReminderTicketKey(rec);
      const reminderKey = ticketKey ? reminderKeyByTicket[ticketKey] : null;
      const rem = reminderKey ? remindersMapByKey[reminderKey] : null;

      if (rem) {
        remindersAttached++;
        return { ...rec, __reminder: rem, __actionKey: reminderKey };
      }

      const existing = rec.__reminder;
      const canonicalKey = existing?.firebaseKey || existing?.id;
      const fallbackRem = canonicalKey ? remindersMapByKey[canonicalKey] : null;
      if (fallbackRem) {
        fallbackRemindersAttached++;
        return { ...rec, __reminder: fallbackRem, __actionKey: canonicalKey };
      }

      const cleaned = { ...rec };
      delete cleaned.__reminder;
      delete cleaned.__actionKey;
      return cleaned;
    });

    console.log(`✅ Credits: Attached ${remindersAttached} reminders by ticket, ${fallbackRemindersAttached} by fallback`);
    return result;
  }, [credits, remindersMapByKey, reminderKeyByTicket]);

  return {
    // State
    remindersMapByKey,
    reminderKeyByTicket,
    remindersLoaded,
    creditsWithReminders,

    // Operations
    cacheReminderSafe,
  };
}
