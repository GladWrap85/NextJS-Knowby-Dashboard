'use client';

import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
import TopKnowbyCard from "@/components/Cards/TopKnowbyCard";
import KnowbyStats from "@/components/Cards/KnowbyStats";
import ViewsCalendarHeatmap from "@/components/Cards/HeatmapCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDateRange } from "@/lib/DateRangeContext";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format
} from "date-fns";
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover";
import { DatePickerWithRange } from "@/components/DateRangePicker";
import { Calendar as CalendarIcon } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { parse } from "date-fns";
import TopMetricsRow from "@/components/Cards/TopMetricsRow";
import AnalyticsExplorer from "@/components/Cards/InsightsCard";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "all-time" | "range";

export default function Home() {
  const { dateRange, setDateRange } = useDateRange();
  const [period, setPeriod] = useState<Period>("weekly");
  const [rangeOpen, setRangeOpen] = useState(false);
  // local custom range (fallback: this week)
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const now = new Date();
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  });

  // --- NEW: compute all-time min/max from sample/real data
  const { completions, views } = useKnowbyData();
  const allTimeRange = useMemo<DateRange>(() => {
    // dates are dd/MM/yyyy in your CSVs
    const toDate = (s?: string) => (s ? parse(s, "dd/MM/yyyy", new Date()) : null);
    let min: Date | null = null;
    let max: Date | null = null;

    for (const r of completions) {
      const d = toDate((r as any)?.date); if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    for (const r of views) {
      const d = toDate((r as any)?.date); if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }

    // fallback to current year if data is empty
    if (!min || !max) {
      const now = new Date();
      return { from: startOfYear(now), to: endOfYear(now) };
    }
    return { from: min, to: max };
  }, [completions, views]);

  const computedRange = useMemo<DateRange>(() => {
    const now = new Date();
    switch (period) {
      case "daily": return { from: now, to: now };
      case "weekly": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case "monthly": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "yearly": return { from: startOfYear(now), to: endOfYear(now) };
      case "all-time": return allTimeRange; // --- NEW
      case "range": return customRange;
    }
  }, [period, customRange, allTimeRange]); // --- NEW: depend on allTimeRange

  // Push chosen window globally
  useEffect(() => {
    if (!computedRange?.from || !computedRange?.to) return;
    setDateRange(computedRange);
  }, [computedRange, setDateRange]);

  // Small pretty label for the active range
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const label = useMemo(() => {
    if (!mounted || !dateRange?.from || !dateRange?.to) return "";
    // deterministic format (no locale/timezone differences from SSR)
    return `${format(dateRange.from, "dd MMM yyyy")} → ${format(dateRange.to, "dd MMM yyyy")}`;
  }, [mounted, dateRange]);

  

  return (
    <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full">
      <div className="relative">
        <div className="relative mt-10 rounded-xl border bg-background shadow-md">
          {/* curved “cradle” around the tabs */}
          <div className="absolute -top-9.5 right-3">
            <div className="rounded-t-2xl border border-b-0 bg-background p-0">
              <TabsList className="bg-transparent rounded-t-2xl px-2 py-1 flex gap-1">
                {/* <TabsTrigger value="daily" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">Daily</TabsTrigger> */}
                <TabsTrigger value="weekly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">Yearly</TabsTrigger>
                <TabsTrigger value="all-time" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">All Time</TabsTrigger>

                {/* Range picker inside tabs */}
                <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPeriod("range")}
                      className={`inline-flex items-center h-7 rounded-md px-3 text-sm transition dark:text-muted-foreground text-black text-semibold
                        ${period === "range" ? "bg-input dark:bg-input/30 border border-input shadow-sm dark:text-white text-black" : "bg-transparent hover:bg-card"}
                      `}
                      title="Custom date range"
                    >
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Range
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-auto">
                    <DatePickerWithRange
                      date={customRange}
                      onSelect={(r) => {
                        // guard against partial selection
                        if (!r?.from || !r?.to) { setCustomRange(r ?? customRange); return; }
                        setCustomRange(r);
                        setPeriod("range");     // keep Range active
                        setRangeOpen(false);    // close popover on completion
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </TabsList>
            </div>
          </div>

          {/* Current range label */}
          <div className="flex justify-end pt-2 pb-2 px-6 text-xs text-muted-foreground">
            {mounted ? label : "\u00A0" /* keep layout without showing mismatched text */}
          </div>

          {/* PAGE CONTENT (block that reacts to global dateRange) */}
          <div className="p-6 pt-0">
            <div className="grid gap-[20px]">

              {/* Top row of cards */}
              <TopMetricsRow selectedDateRange={dateRange} />
              
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* <TotalUsageCard /> */}
                <div className="col-span-1 xl:col-span-2">
                  <TodaysUsageCard selectedDateRange={dateRange} />
                </div>
                <TopKnowbyCard selectedDateRange={dateRange} />
              </div>
              {/* Knowby Stats + Heatmap */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-[20px]">
                <KnowbyStats selectedDateRange={dateRange} />

                <ViewsCalendarHeatmap selectedDateRange={dateRange} />
              </div>

              {/* Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-[20px]">
                <AnalyticsExplorer selectedDateRange={dateRange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Tabs>
  );
}
