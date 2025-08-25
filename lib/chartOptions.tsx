// utils/chartOptions.ts
import type { ApexOptions } from "apexcharts";

export const topChartOptions = (isDark: boolean): ApexOptions => ({
  chart: {
    type: "area",
    toolbar: { show: false },
    zoom: { enabled: false }
  },
  dataLabels: { enabled: false },
  stroke: { curve: "smooth", width: 2 },
  markers: { size: 0 },
  xaxis: {
    type: "datetime",
    tooltip: { enabled: false },
    tickAmount: 6,
    labels: {
      datetimeUTC: false,
      rotate: 0,
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


export const sparklineChartOptions: ApexOptions = {
    chart: { type: "area", sparkline: { enabled: true } },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 1, opacityTo: 0, stops: [0, 100] },
    },
    tooltip: { enabled: false },
    yaxis: { show: false },
};
