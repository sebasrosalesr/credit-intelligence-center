// src/components/tabs/KpisTab.jsx
import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { getAccountGroup } from "../../utils/account";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const INITIAL_KPI_NOW = Date.now();

/**
 * KPIs / Charts tab wrapper.
 * Relies on analytics and recent credits precomputed in App to avoid duplicate work.
 */
function KpisTab({ analytics, credits, formatCurrency, toNumber }) {

  // Aggregations
  const volumeData = analytics.volumeByDate.map(([date, value]) => ({ label: date, value }));

  const accountGroups = useMemo(() => {
    const map = new Map();
    credits.forEach((rec) => {
      const acct = getAccountGroup(rec["Customer Number"]);
      map.set(acct, (map.get(acct) || 0) + toNumber(rec["Credit Request Total"]));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [credits, toNumber]);

  const items = useMemo(() => {
    const map = new Map();
    credits.forEach((rec) => {
      const item = rec["Item Number"] || "Unknown";
      map.set(item, (map.get(item) || 0) + toNumber(rec["Credit Request Total"]));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [credits, toNumber]);

  const accountPrefixesHigh = useMemo(() => {
    const cutoff = INITIAL_KPI_NOW - 60 * 24 * 60 * 60 * 1000;
    const map = new Map();
    credits.forEach((rec) => {
      const d = new Date(rec.Date);
      if (Number.isNaN(d.getTime()) || d.getTime() < cutoff) return;
      const amt = toNumber(rec["Credit Request Total"]);
      if (amt <= 2500) return;
      const acct = getAccountGroup(rec["Customer Number"]);
      map.set(acct, (map.get(acct) || 0) + amt);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [credits, toNumber]);

  const linesByTicket = useMemo(() => {
    const mk = (days) => {
      const cutoff = INITIAL_KPI_NOW - days * 24 * 60 * 60 * 1000;
      const map = new Map();
      credits.forEach((rec) => {
        const d = new Date(rec.Date);
        if (Number.isNaN(d.getTime()) || d.getTime() < cutoff) return;
        const ticket = rec["Ticket Number"] || "Unknown";
        map.set(ticket, (map.get(ticket) || 0) + 1);
      });
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));
    };
    return { last15: mk(15), last30: mk(30) };
  }, [credits]);

  return (
    <section style={{ padding: "1.1rem", display: "grid", gap: "1.4rem" }}>
      <div
        className="kpi-grid"
        style={{
          display: "grid",
          gap: "1.2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(560px, 1fr))",
        }}
      >
        <ChartCard title="Credit Volume (last 14 days)">
          <BarChart
            data={volumeData}
            formatValue={formatCurrency}
            color="rgba(59,130,246,0.7)"
            datasetLabel="Credit Total"
          />
        </ChartCard>
        <ChartCard title="Top 10 Account Groups by Credit Total (last 90 days)">
          <BarChart
            data={accountGroups}
            formatValue={formatCurrency}
            color="rgba(16,185,129,0.7)"
            datasetLabel="Credit Total"
          />
        </ChartCard>
        <ChartCard title="Top 10 Item Numbers by Credit Total (last 90 days)">
          <BarChart
            data={items}
            formatValue={formatCurrency}
            color="rgba(234,179,8,0.8)"
            datasetLabel="Credit Total"
          />
        </ChartCard>
        <ChartCard title="Account prefixes > $2,500 (last 60 days) — Need approval">
          <BarChart
            data={accountPrefixesHigh}
            formatValue={formatCurrency}
            color="rgba(248,113,113,0.7)"
            datasetLabel="Credit Total"
          />
        </ChartCard>
        <ChartCard title="Lines added per ticket (last 15 days)">
          <BarChart
            data={linesByTicket.last15}
            formatValue={(v) => v}
            color="rgba(59,130,246,0.7)"
            datasetLabel="Lines added"
          />
        </ChartCard>
        <ChartCard title="Lines added per ticket (last 30 days)">
          <BarChart
            data={linesByTicket.last30}
            formatValue={(v) => v}
            color="rgba(16,185,129,0.7)"
            datasetLabel="Lines added"
          />
        </ChartCard>
        <ChartCard title="SLA buckets (pending, last 90 days)">
          {(() => {
            const slaData = (analytics.slaBuckets || []).map((d) =>
              Array.isArray(d) ? { label: d[0], value: d[1] } : d
            );
            const hasValues = slaData.some((d) => Number(d.value) > 0);
            if (!hasValues) {
              return <Muted>No pending credits in last 90 days.</Muted>;
            }
            const palette = {
              "<30d": "rgba(34,197,94,0.8)",
              "30-59d": "rgba(234,179,8,0.8)",
              "60d+": "rgba(248,113,113,0.8)",
              "n/a": "rgba(148,163,184,0.6)",
            };
            const colors = slaData.map((d) => palette[d.label] || "rgba(59,130,246,0.8)");
            const total = slaData.reduce((sum, d) => sum + Number(d.value || 0), 0);
            return (
              <BarChart
                data={slaData}
                formatValue={(v) => {
                  const pct = total ? ` (${((v / total) * 100).toFixed(1)}%)` : "";
                  return `${v.toLocaleString()}${pct}`;
                }}
                color={colors}
                datasetLabel="Count"
              />
            );
          })()}
        </ChartCard>
      </div>
    </section>
  );
}

const KpiCard = ({ label, value }) => (
  <div
    className="panel"
    style={{
      padding: "0.9rem 1.1rem",
      minWidth: 220,
    }}
  >
    <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{label}</div>
    <div
      style={{
        color: "#e5e7eb",
        fontWeight: 700,
        fontSize: "1.2rem",
        marginTop: 4,
      }}
    >
      {value}
    </div>
  </div>
);

const Muted = ({ children }) => (
  <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{children}</div>
);

const ChartCard = ({ title, children }) => (
  <div className="panel chart-card" style={{ padding: "1.2rem 1.4rem 1.3rem" }}>
    <div className="noise" />
    <h3 className="chart-title" style={{ margin: "0 0 0.5rem", color: "#e5e7eb", fontSize: "0.95rem", fontWeight: 600 }}>
      {title}
    </h3>
    <div className="chart-container">{children}</div>
  </div>
);

const BarChart = ({ data, formatValue, color, datasetLabel = "Value" }) => {
  if (!data || data.length === 0) return <Muted>No data.</Muted>;

  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: datasetLabel,
        data: values,
        backgroundColor: color,
        borderRadius: 8,
        maxBarThickness: 38,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },

    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#e5e7eb",
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.95)",
        borderColor: "rgba(31,41,55,0.8)",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            return formatValue ? formatValue(v) : v;
          },
        },
      },
    },

    scales: {
      x: {
        ticks: {
          color: "#9ca3af",
          font: { size: 10 },
        },
        // DEFAULT grid lines (what the original screenshot had)
        grid: {
          color: "rgba(55,65,81,0.3)",
          borderColor: "rgba(55,65,81,0.8)",
        },
      },
      y: {
        ticks: {
          color: "#9ca3af",
          font: { size: 10 },
          callback: (v) => (formatValue ? formatValue(v) : v),
        },
        grid: {
          color: "rgba(55,65,81,0.3)",
          borderColor: "rgba(55,65,81,0.8)",
        },
      },
    },

    elements: {
      bar: {
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.7,
      },
    },
  };

  return (
    <div style={{ height: 260, marginTop: 4 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

const Th = ({ children }) => (
  <th
    style={{
      textAlign: "left",
      padding: "0.5rem 0.6rem",
      color: "#9ca3af",
      fontWeight: 600,
    }}
  >
    {children}
  </th>
);

const Td = ({ children }) => (
  <td
    style={{
      padding: "0.5rem 0.6rem",
      color: "#e5e7eb",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </td>
);

export default KpisTab;
