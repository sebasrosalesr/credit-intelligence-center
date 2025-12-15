import { useEffect } from "react";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { LoggerProvider, useLogger } from "./logger.jsx";
import { initSentry } from "./sentry";

function BoundaryWithLogger({ children }) {
  const { logClientEvent } = useLogger();

  return (
    <ErrorBoundary
      onError={(error, info) =>
        logClientEvent({
          level: "error",
          message: error?.message || "React render error",
          stack: error?.stack,
          componentStack: info?.componentStack,
        })
      }
      fallback={({ error, reset }) => (
        <div
          className="panel"
          style={{
            margin: "2rem",
            padding: "1.5rem",
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(248,113,113,0.06)",
            color: "#fecdd3",
          }}
        >
          <h3 style={{ marginTop: 0 }}>We hit a snag</h3>
          <p style={{ color: "#fda4af" }}>{error?.message || "Unknown error"}</p>
          <button className="btn" type="button" onClick={reset}>
            Reload view
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

function SentryInitializer({ children }) {
  useEffect(() => {
    // Initialize Sentry monitoring
    initSentry();
  }, []);

  return children;
}

export default function MonitoringBoundary({ children }) {
  return (
    <LoggerProvider options={{ throttleMs: 1800 }}>
      <SentryInitializer>
        <BoundaryWithLogger>{children}</BoundaryWithLogger>
      </SentryInitializer>
    </LoggerProvider>
  );
}
