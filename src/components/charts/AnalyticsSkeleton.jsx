function Skeleton({ width = "100%", height = 12 }) {
  return (
    <span
      className="skeleton"
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: 10,
      }}
    />
  );
}

export default function AnalyticsSkeleton() {
  return (
    <>
      {[0, 1].map((idx) => (
        <div className="panel" key={`analytics-skeleton-${idx}`} data-animate>
          <h3 style={{ margin: 0, marginBottom: "0.5rem", color: "#cbd5e1" }}>Loading analytics…</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton width="40%" height={18} />
            <Skeleton width="65%" height={12} />
            <Skeleton width="55%" height={12} />
            <Skeleton width="70%" height={12} />
          </div>
        </div>
      ))}
    </>
  );
}
