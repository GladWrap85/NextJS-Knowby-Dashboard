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
        <AnalyticsExplorer selectedDateRange={dateRange} />
      </div>
    </DatePeriodContainer>
  );
}
