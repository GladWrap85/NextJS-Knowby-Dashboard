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
  tableContent: React.ReactNode;
  layout?: "vertical" | "horizontal"; // vertical = graph above table, horizontal = graph beside table
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
  chartHeight = 160,
  chartOptions,
  tableContent,
  layout = "vertical",
}: StatsPopupGraphProps) {
  return (
    <div
      className={`flex ${
        layout === "vertical" ? "flex-col gap-4" : "flex-row gap-6"
      }`}
    >
      <div className={layout === "vertical" ? "w-full" : "w-1/3"}>
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

      <div
        className={
          layout === "vertical" ? "" : "flex-1 overflow-auto max-h-[400px]"
        }
      >
        {tableContent}
      </div>
    </div>
  );
}
