import React, { Component } from "react";
import { captureException } from "../monitoring/sentry";

const TEXT = {
  errorTitle: {
    fontSize: "1.25rem",
    fontWeight: "bold",
    color: "#ef4444",
    marginBottom: "0.5rem",
  },
  errorMessage: {
    fontSize: "0.9rem",
    color: "#9ca3af",
    marginBottom: "1rem",
    lineHeight: 1.5,
  },
  errorDetails: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontFamily: "monospace",
    background: "#111827",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    border: "1px solid #374151",
    marginBottom: "1rem",
    maxHeight: "200px",
    overflow: "auto",
  },
  retryButton: {
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
  },
  retryButtonHover: {
    transform: "translateY(-1px)",
    boxShadow: "0 6px 16px rgba(59, 130, 246, 0.6)",
  },
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to your error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Store error details for display
    this.setState({
      error,
      errorInfo,
    });

    // Send to Sentry for monitoring
    captureException(error, {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Log to monitoring service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.state.errorId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          fallback={this.props.fallback}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo, errorId, onRetry, fallback }) {
  // If a custom fallback is provided, use it
  if (fallback) {
    return fallback({ error, errorInfo, errorId, onRetry });
  }

  return (
    <div
      style={{
        padding: "2rem",
        margin: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid #dc2626",
        background: "linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(153, 27, 27, 0.05))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        maxWidth: "600px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <div
          style={{
            fontSize: "3rem",
            marginBottom: "0.5rem",
            opacity: 0.8,
          }}
        >
          ⚠️
        </div>
        <h2 style={TEXT.errorTitle}>Something went wrong</h2>
      </div>

      <p style={TEXT.errorMessage}>
        We encountered an unexpected error. This has been logged and we'll look into it.
        You can try refreshing the page or going back to a previous page.
      </p>

      {error && (
        <details style={{ width: "100%", marginBottom: "1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            Technical Details (for developers)
          </summary>
          <div style={TEXT.errorDetails}>
            <strong>Error ID:</strong> {errorId}
            <br />
            <strong>Message:</strong> {error.message}
            <br />
            <strong>Stack:</strong>
            <pre style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
              {error.stack}
            </pre>
            {errorInfo && (
              <>
                <strong>Component Stack:</strong>
                <pre style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                  {errorInfo.componentStack}
                </pre>
              </>
            )}
          </div>
        </details>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={onRetry}
          style={TEXT.retryButton}
          onMouseEnter={(e) => {
            Object.assign(e.target.style, TEXT.retryButtonHover);
          }}
          onMouseLeave={(e) => {
            Object.assign(e.target.style, TEXT.retryButton);
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            ...TEXT.retryButton,
            background: "linear-gradient(135deg, #6b7280, #4b5563)",
            boxShadow: "0 4px 12px rgba(107, 114, 128, 0.4)",
          }}
          onMouseEnter={(e) => {
            Object.assign(e.target.style, {
              ...TEXT.retryButtonHover,
              background: "linear-gradient(135deg, #4b5563, #374151)",
              boxShadow: "0 6px 16px rgba(107, 114, 128, 0.6)",
            });
          }}
          onMouseLeave={(e) => {
            Object.assign(e.target.style, {
              ...TEXT.retryButton,
              background: "linear-gradient(135deg, #6b7280, #4b5563)",
              boxShadow: "0 4px 12px rgba(107, 114, 128, 0.4)",
            });
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// Specialized error boundaries for different parts of the app
export function TabErrorBoundary({ children, tabName }) {
  return (
    <ErrorBoundary
      fallback={({ error, onRetry }) => (
        <div
          style={{
            padding: "1.5rem",
            margin: "1rem 0",
            borderRadius: "0.5rem",
            border: "1px solid #f59e0b",
            background: "rgba(245, 158, 11, 0.1)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
          <h3 style={{ color: "#f59e0b", marginBottom: "0.5rem" }}>
            {tabName} Tab Error
          </h3>
          <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
            There was a problem loading the {tabName.toLowerCase()} tab.
          </p>
          <button onClick={onRetry} style={TEXT.retryButton}>
            Retry Loading Tab
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, componentName = "Component" }) {
  return (
    <ErrorBoundary
      fallback={({ onRetry }) => (
        <div
          style={{
            padding: "1rem",
            margin: "0.5rem 0",
            borderRadius: "0.375rem",
            border: "1px solid #f59e0b",
            background: "rgba(245, 158, 11, 0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>⚠️</div>
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
            {componentName} failed to load
          </p>
          <button
            onClick={onRetry}
            style={{
              ...TEXT.retryButton,
              fontSize: "0.75rem",
              padding: "0.25rem 0.75rem",
              marginTop: "0.5rem",
            }}
          >
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
