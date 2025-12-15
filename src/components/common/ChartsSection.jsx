import BarChart from "../charts/BarChart.jsx";
import HorizontalBarChart from "../charts/HorizontalBarChart.jsx";
import AnalyticsSkeleton from "../charts/AnalyticsSkeleton.jsx";
import FadeInPanel from "../charts/FadeInPanel.jsx";

const Muted = ({ children }) => (
  <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{children}</div>
);

export default function ChartsSection({ analyticsReady, isRemoteLoading, analytics, formatCurrency }) {
  if (!analyticsReady || isRemoteLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)",
        gap: "1.5rem",
      }}
    >
      <div className="panel" data-animate="2">
        <FadeInPanel>
          <h3
            style={{
              margin: 0,
              marginBottom: "0.5rem",
              fontSize: "0.95rem",
              color: "#e5e7eb",
            }}
          >
            📊 Credit Volume (last 14 days)
          </h3>
          {analytics.volumeByDate?.length ? (
            <BarChart data={analytics.volumeByDate} formatValue={(v) => formatCurrency(v)} />
          ) : (
            <Muted>No volume data available.</Muted>
          )}
        </FadeInPanel>
      </div>

      <div className="panel" data-animate="3">
        <FadeInPanel>
          <h3
            style={{
              margin: 0,
              marginBottom: "0.5rem",
              fontSize: "0.95rem",
              color: "#e5e7eb",
            }}
          >
            🧑‍💼 Top Reps by Credit Total
          </h3>
          {analytics.topReps?.length ? (
            <HorizontalBarChart data={analytics.topReps} formatCurrency={formatCurrency} />
          ) : (
            <Muted>No rep data available.</Muted>
          )}
        </FadeInPanel>
      </div>
    </section>
  );
}
