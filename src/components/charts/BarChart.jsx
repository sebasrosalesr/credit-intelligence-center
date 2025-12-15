import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { createBaseOptions } from "./chartTheme";

export default function BarChart({ data, formatValue }) {
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
          backgroundColor: "rgba(56,189,248,0.8)",
          borderColor: "rgba(125,211,252,0.9)",
          borderWidth: 1.2,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 32,
          categoryPercentage: 0.75,
          barPercentage: 0.8,
          hoverBackgroundColor: "rgba(56,189,248,1)",
        },
      ],
    };
  }, [data]);

  const baseOpts = useMemo(() => createBaseOptions({ yTitle: "Amount" }), []);

  const options = useMemo(
    () => ({
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        tooltip: {
          ...baseOpts.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y || 0;
              return formatValue ? formatValue(v) : v;
            },
          },
        },
      },
    }),
    [baseOpts, formatValue]
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "340px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
