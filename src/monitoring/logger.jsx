/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

const LoggerContext = createContext({ logClientEvent: () => {} });

function persistBuffer(entries) {
  try {
    sessionStorage.setItem("cic-client-logs", JSON.stringify(entries.slice(-25)));
  } catch {
    // best-effort only
  }
}

export function useClientLogger({ throttleMs = 2500, maxEntries = 25 } = {}) {
  const lastFlushRef = useRef(0);
  const bufferRef = useRef([]);

  const logClientEvent = useCallback(
    (payload) => {
      const entry = {
        level: payload?.level || "info",
        message: payload?.message || "client-event",
        stack: payload?.stack,
        meta: payload?.meta,
        componentStack: payload?.componentStack,
        timestamp: Date.now(),
      };

      bufferRef.current = [...bufferRef.current.slice(-(maxEntries - 1)), entry];
      persistBuffer(bufferRef.current);

      const now = Date.now();
      if (now - lastFlushRef.current >= throttleMs || entry.level === "error") {
        lastFlushRef.current = now;
        // Surface to console; a backend hook could also live here.
        console.warn("[client-log]", entry);
      }
    },
    [maxEntries, throttleMs]
  );

  useEffect(() => {
    const handleError = (event) =>
      logClientEvent({
        level: "error",
        message: event?.message || "Unhandled error",
        stack: event?.error?.stack,
        meta: { source: event?.filename, line: event?.lineno, col: event?.colno },
      });

    const handleRejection = (event) =>
      logClientEvent({
        level: "error",
        message: event?.reason?.message || "Unhandled rejection",
        stack: event?.reason?.stack,
      });

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [logClientEvent]);

  return { logClientEvent };
}

export function LoggerProvider({ children, options }) {
  const logger = useClientLogger(options);
  const value = useMemo(() => ({ logClientEvent: logger.logClientEvent }), [logger.logClientEvent]);
  return <LoggerContext.Provider value={value}>{children}</LoggerContext.Provider>;
}

export function useLogger() {
  return useContext(LoggerContext);
}
