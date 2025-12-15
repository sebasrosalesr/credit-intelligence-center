import { ShieldAlert } from "lucide-react";
import { TEXT } from "../../config/textStyles";

function TabButton({ children, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={active ? "tab tab--active" : "tab"}>
      {children}
    </button>
  );
}

export default function AppHeader({
  firebaseEnv,
  statusLabel,
  statusColor,
  lastUpdatedLabel,
  roleLabel,
  authEmail,
  onLogout,
  availableTabs,
  activeTab,
  onTabChange,
}) {
  return (
    <header className="neo-header neo-header--hover">
      <div className="neo-header-accent-strip" />

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.1rem",
            flex: "1 1 260px",
            minWidth: 0,
          }}
        >
          <img
            src="/twinmed-logo.avif"
            alt="TwinMed logo"
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
              borderRadius: "1.2rem",
              flexShrink: 0,
            }}
          />

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div className="header-title-glow" />
            <div
              style={{
                fontSize: "0.7rem",
                opacity: 0.56,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#a5b4fc",
              }}
            >
              TwinMed CIC Platform
            </div>

            <h1 style={{ ...TEXT.displayTitle, margin: 0 }}>Credit Intelligent Center</h1>
            <p style={{ margin: 0, ...TEXT.subtitle }}>AI-powered credit processing &amp; operations automation.</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.45rem",
            flexShrink: 0,
            minWidth: 230,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.25rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.4)",
              background:
                firebaseEnv === "sandbox"
                  ? "linear-gradient(135deg, rgba(34,197,94,0.20), rgba(15,23,42,0.96))"
                  : "linear-gradient(135deg, rgba(59,130,246,0.24), rgba(15,23,42,0.96))",
              color: firebaseEnv === "sandbox" ? "#6ee7b7" : "#93c5fd",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <ShieldAlert size={13} />
            Environment: {firebaseEnv === "sandbox" ? "Sandbox" : "Production"}
          </span>

          <span
            style={{
              fontSize: "0.8rem",
              color: statusColor,
              maxWidth: 260,
              textAlign: "right",
            }}
          >
            {statusLabel}
          </span>

          {lastUpdatedLabel && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              {lastUpdatedLabel}
            </span>
          )}

          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                color: "#d1d5db",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Role: {roleLabel}
            </span>
            {authEmail && (
              <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{authEmail}</span>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onLogout}
              style={{
                fontSize: "0.75rem",
                padding: "0.35rem 0.8rem",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "1rem",
          height: "1px",
          width: "100%",
          background:
            "linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.38), rgba(16,185,129,0.4), rgba(59,130,246,0))",
          opacity: 0.85,
          filter: "blur(0.25px)",
        }}
      />

      <div
        style={{
          marginTop: "0.85rem",
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabButton
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => onTabChange(tab.key)}
            >
              <Icon size={16} /> {tab.label}
            </TabButton>
          );
        })}
      </div>
    </header>
  );
}
