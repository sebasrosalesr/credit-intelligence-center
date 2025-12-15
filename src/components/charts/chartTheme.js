import { Chart as ChartJS } from "chart.js/auto";

// Global defaults for a premium dark feel
ChartJS.defaults.font.family = "'SF Pro Text', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
ChartJS.defaults.color = "rgba(226,232,240,0.85)";

export function createBaseOptions({ yTitle, xTitle, stacked = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 450,
      easing: "easeOutCubic",
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          boxWidth: 12,
          boxHeight: 4,
          usePointStyle: true,
          padding: 6,
          color: "rgba(226,232,240,0.72)",
        },
        align: "end",
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(15,23,42,0.96)",
        borderColor: "rgba(148,163,184,0.5)",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        titleFont: { size: 13, weight: "600" },
        bodyFont: { size: 12 },
        displayColors: false,
      },
    },
    scales: {
      x: {
        stacked,
        grid: {
          display: true,
          color: "rgba(255,255,255,0.035)",
          drawBorder: false,
        },
        ticks: {
          maxRotation: 30,
          minRotation: 30,
          font: { size: 11 },
          color: "rgba(226,232,240,0.72)",
        },
        title: xTitle
          ? {
              display: true,
              text: xTitle,
              color: "rgba(148,163,184,0.9)",
              padding: { top: 6 },
              font: { size: 11, weight: "500" },
            }
          : undefined,
      },
      y: {
        stacked,
        grid: {
          color: "rgba(255,255,255,0.035)",
          drawBorder: false,
        },
        ticks: {
          font: { size: 11 },
          color: "rgba(226,232,240,0.72)",
        },
        title: yTitle
          ? {
              display: true,
              text: yTitle,
              color: "rgba(148,163,184,0.9)",
              padding: { bottom: 6 },
              font: { size: 11, weight: "500" },
            }
          : undefined,
      },
    },
  };
}
