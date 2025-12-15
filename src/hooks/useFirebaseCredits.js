/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { db } from "../firebase";

export function useFirebaseCredits(logClientEvent) {
  const [liveCredits, setLiveCredits] = useState([]);
  const [firebaseStatus, setFirebaseStatus] = useState("idle");
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  useEffect(() => {
    if (!db) {
      console.warn("⚠️ No Firebase DB instance – using mock data only");
      setFirebaseStatus("mock");
      logClientEvent?.({ level: "info", message: "Firebase DB not configured, using mock data" });
      return;
    }

    const creditsRef = ref(db, "credit_requests");
    setFirebaseStatus("loading");
    console.log("🔌 Subscribing to credit_requests…");
    logClientEvent?.({ level: "info", message: "Subscribing to credit_requests" });

    const unsubscribeCredits = onValue(
      creditsRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log("📥 Firebase credit_requests snapshot:", data);

        if (!data) {
          setLiveCredits([]);
          setFirebaseStatus("live");
          setLastLiveRefresh(new Date());
          return;
        }

        const parsed = Object.entries(data).map(([id, rec]) => ({
          id,
          ...rec,
        }));

        setLiveCredits(parsed);
        setFirebaseStatus("live");
        setLastLiveRefresh(new Date());
      },
      (err) => {
        console.error("❌ Firebase read error:", err);
        setFirebaseStatus("error");
        logClientEvent?.({
          level: "error",
          message: "Firebase read error",
          stack: err?.stack,
          meta: { code: err?.code, message: err?.message },
        });
      }
    );

    return () => {
      unsubscribeCredits();
    };
  }, [logClientEvent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { liveCredits, setLiveCredits, firebaseStatus, lastLiveRefresh };
}
