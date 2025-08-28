// StatsPopupGraph.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface StatsPopupGraphProps {
  chartSeries: { x: string; y: number }[];
  chartLabel: string;
  chartHeight?: number;
  chartOptions?: ApexOptions;
  layout?: "vertical" | "horizontal"; // kept for possible future use
}

const baseChartOptions: ApexOptions = {
  chart: {
    type: "area",
    sparkline: { enabled: false },
  },
  stroke: {
    curve: "smooth",
    width: 2,
  },
  fill: {
    type: "gradient",
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.6,
      opacityTo: 0,
      stops: [0, 100],
    },
  },
  tooltip: { enabled: true },
  yaxis: { show: true },
};

export default function StatsPopupGraph({
  chartSeries,
  chartLabel,
  chartHeight = 220,
  chartOptions,
}: StatsPopupGraphProps) {
  return (
    <div className="w-full">
      <Chart
        options={{
          ...baseChartOptions,
          ...chartOptions,
          xaxis: { type: "category" },
        }}
        series={[{ name: chartLabel, data: chartSeries }]}
        type="area"
        height={chartHeight}
      />
    </div>
  );
}
