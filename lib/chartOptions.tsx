// utils/chartOptions.ts
import type { ApexOptions } from "apexcharts";

export const topChartOptions = (isDark: boolean): ApexOptions => ({
  chart: {
    type: "area",
    toolbar: { show: false },
  },
  dataLabels: { enabled: false },
  stroke: { curve: "smooth", width: 2 },
  markers: { size: 0 },
  xaxis: {
    type: "datetime",
    tickAmount: 6,
    labels: {
      datetimeUTC: false,
      rotate: -30,
      format: "MMM yyyy",
      style: { colors: isDark ? "#aaa" : "" },
    },
  },
  yaxis: {
    tickAmount: 4,
    labels: {
      formatter: (v: number) => `${Math.round(v)}`,
      style: { colors: isDark ? "#aaa" : "" },
    },
  },
  tooltip: {
    shared: true,
    x: { format: "MMM yyyy" },
    theme: isDark ? "dark" : "light",
  },
  grid: {
    strokeDashArray: 2,
    borderColor: isDark ? "#444" : "#aaa",
  },
  fill: {
    type: "gradient",
    gradient: {
      shadeIntensity: 0.4,
      opacityFrom: 0.7,
      opacityTo: 0.3,
      stops: [0, 90, 100],
    },
  },
  legend: {
    position: "top",
    floating: true,
    labels: { colors: isDark ? "#aaa" : "" },
  },
});
