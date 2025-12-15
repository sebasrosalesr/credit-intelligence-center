import { useEffect, useMemo, useState, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { getStrictReminderTicketKey } from "../utils/recordHelpers";

/**
 * Custom hook for managing reminders data and operations
 * @param {Object} db - Firebase database instance
 * @param {Array} credits - Array of credit records
 * @param {Function} logClientEvent - Logging function
 * @returns {Object} Reminders state and operations
 */
export function useReminders(db, credits = [], logClientEvent) {
  const [remindersMapByKey, setRemindersMapByKey] = useState({});
  const [reminderKeyByTicket, setReminderKeyByTicket] = useState({});
  const [remindersLoaded, setRemindersLoaded] = useState(false);

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
      const byKey = {};
      const byTicket = {};
      let reminderCount = 0;

      Object.entries(raw).forEach(([firebaseKey, reminder]) => {
        if (!reminder) {
          console.warn(`⚠️ Reminders: Skipping null/undefined reminder at key ${firebaseKey}`);
          return;
        }
        const normalized = { ...reminder, firebaseKey };
        const ticketKey = getStrictReminderTicketKey(reminder);

        byKey[firebaseKey] = normalized;
        if (ticketKey) {
          byTicket[ticketKey] = firebaseKey;
        } else {
          console.warn(`⚠️ Reminders: Reminder ${firebaseKey} has no ticket_number or ticket field`, reminder);
        }
        reminderCount++;
      });

      console.log(`✅ Reminders: Loaded ${reminderCount} reminders (${Object.keys(byTicket).length} with tickets)`);
      console.log('🔍 Reminders: Sample reminders:', Object.values(byKey).slice(0, 3).map(r => ({ id: r.id, status: r.status, ticket: r.ticket_number })));
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
  const cacheReminderSafe = useCallback((firebaseKey, reminder) => {
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
  const creditsWithReminders = useMemo(() => {
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
