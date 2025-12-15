export default function SummaryCard({ label, value, subtitle, loading = false, Skeleton }) {
  return (
    <div className="panel summary-card" data-animate>
      <div className="summary-label">{label}</div>
      <div className="summary-value">
        {loading && Skeleton ? <Skeleton width="70%" height={24} /> : value}
      </div>
      <div className="summary-sub">
        {loading && Skeleton ? <Skeleton width="50%" height={14} /> : subtitle}
      </div>
    </div>
  );
}
