// app/(dashboard)/page.tsx
"use client";

import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
import TopKnowbyCard from "@/components/Cards/TopKnowbyCard";
import KnowbyStats from "@/components/Cards/KnowbyStats";
import ViewsCalendarHeatmap from "@/components/Cards/HeatmapCard";
import TopMetricsRow from "@/components/Cards/TopMetricsRow";
import AnalyticsExplorer from "@/components/Cards/InsightsCard";
import { useDateRange } from "@/lib/DateRangeContext";
import DatePeriodContainer from "@/components/DatePeriodContainer";

export default function Home() {
  const { dateRange } = useDateRange();

  return (
    <DatePeriodContainer initialPeriod="weekly" className="w-full">
      <div className="grid gap-[20px]">
        <TopMetricsRow selectedDateRange={dateRange} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
          <div className="col-span-1 xl:col-span-2">
            <TodaysUsageCard selectedDateRange={dateRange} />
          </div>
          <TopKnowbyCard selectedDateRange={dateRange} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[20px]">
          <KnowbyStats selectedDateRange={dateRange} />
          <ViewsCalendarHeatmap selectedDateRange={dateRange} />
        </div>

        <div className="grid grid-cols-1 gap-[20px]">
          <AnalyticsExplorer selectedDateRange={dateRange} />
        </div>
      </div>
    </DatePeriodContainer>
  );
}
