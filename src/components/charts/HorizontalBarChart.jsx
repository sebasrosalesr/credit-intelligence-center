import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { createBaseOptions } from "./chartTheme";

export default function HorizontalBarChart({ data, formatCurrency }) {
  const chartData = useMemo(() => {
    if (!data || !data.length) {
      return { labels: [], datasets: [] };
    }

    const labels = data.map((d) => d[0]);
    const values = data.map((d) => d[1]);

    return {
      labels,
      datasets: [
        {
          label: "Credit Total",
          data: values,
          backgroundColor: "rgba(34,197,94,0.85)",
          borderColor: "rgba(74,222,128,0.95)",
          borderWidth: 1.2,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 24,
          maxBarThickness: 32,
          categoryPercentage: 0.75,
          barPercentage: 0.8,
          hoverBackgroundColor: "rgba(34,197,94,1)",
        },
      ],
    };
  }, [data]);

  const baseOpts = useMemo(() => createBaseOptions({ xTitle: "Credit Total" }), []);

  const options = useMemo(
    () => ({
      ...baseOpts,
      indexAxis: "y",
      animation: {
        duration: 500,
        easing: "easeOutCubic",
      },
      interaction: {
        mode: "nearest",
        intersect: true,
        axis: "xy",
      },
      plugins: {
        ...baseOpts.plugins,
        legend: {
          ...baseOpts.plugins.legend,
          align: "end",
        },
        tooltip: {
          ...baseOpts.plugins.tooltip,
          callbacks: {
            title: (items) => (items && items[0] ? items[0].label : ""),
            label: (ctx) => {
              const v = ctx.parsed.x || 0;
              return formatCurrency ? formatCurrency(v) : v;
            },
          },
        },
        title: baseOpts.plugins?.title
          ? { ...baseOpts.plugins.title, align: "start" }
          : baseOpts.plugins?.title,
      },
      scales: {
        ...baseOpts.scales,
        y: {
          ...baseOpts.scales.y,
          ticks: {
            ...baseOpts.scales.y?.ticks,
            autoSkip: false,
            font: { size: 11 },
          },
        },
      },
    }),
    [baseOpts, formatCurrency]
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "340px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
