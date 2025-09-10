'use client';

import TotalUsageCard from "@/components/Cards/TotalUsageCard";
import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
import TopKnowbyCard from "@/components/Cards/TopKnowbyCard";
import ModularGraphCard from "@/components/Cards/InsightsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import KnowbyStats from "@/components/Cards/KnowbyStats";
import ViewsCalendarHeatmap from "@/components/cal-heatmap";
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
import { DatePickerWithRange } from "@/components/DateRangePicker"; // your component
import { ArrowDownRight, ArrowUpRight, BookOpen, Calendar as CalendarIcon, CheckCheck, Eye, Percent, User } from "lucide-react";
// --- NEW: pull raw data to compute all-time span
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { parse } from "date-fns";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "all-time" | "range"; // --- NEW: add "all-time"

export default function Home() {
  const { dateRange, setDateRange } = useDateRange();
  const [period, setPeriod] = useState<Period>("daily");
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
          <div className="absolute -top-11.5 right-3">
            <div className="rounded-t-2xl border border-b-0 bg-background p-1">
              <TabsList className="bg-transparent rounded-t-2xl px-2 py-1 flex gap-1">
                <TabsTrigger value="daily" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">Yearly</TabsTrigger>
                <TabsTrigger value="all-time" className="cursor-pointer data-[state=active]:bg-input hover:bg-card">All Time</TabsTrigger>

                {/* Range picker inside tabs */}
                <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPeriod("range")}
                      className={`inline-flex items-center h-7 rounded-md px-3 text-sm transition
                        ${period === "range" ? "bg-input/30 border border-input shadow-sm text-white" : "bg-transparent hover:bg-card"}
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">

                {/* Active Members */}
                <Card className="flex flex-row items-center p-4 bg-card border-none shadow-none gap-3 bg-gradient-to-br from-blue-900/30 to-blue-500/10">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-600/20 text-teal-500">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Active Members</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">125</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950 p-0.5 rounded">
                        <ArrowUpRight className="h-3 w-3" />
                        5.0%
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Knowbys */}
                <Card className="flex flex-row items-center p-4 bg-card border-none shadow-none gap-3 bg-gradient-to-br from-blue-900/30 to-blue-500/10">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-500">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Knowbys</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">47</span>
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-rose-500/30 dark:text-redd-500 dark:bg-rose-950 p-0.5 rounded">
                        <ArrowUpRight className="h-3 w-3" />
                        1.2%
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Views */}
                <Card className="flex flex-row items-center p-4 bg-card border-none shadow-none gap-3 bg-gradient-to-br from-blue-900/30 to-blue-500/10">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600/20 text-blue-500">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Views</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">5,291</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950 p-0.5 rounded">
                        <ArrowUpRight className="h-3 w-3" />
                        0.8%
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Completions */}
                <Card className="flex flex-row items-center p-4 bg-card border-none shadow-none gap-3 bg-gradient-to-br from-blue-900/30 to-blue-500/10">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600/20 text-green-500">
                    <CheckCheck className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Completions</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">127</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950 p-0.5 rounded">
                        <ArrowUpRight className="h-3 w-3" />
                        2.4%
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Completion Rate */}
                <Card className="flex flex-row items-center p-4 bg-card border-none shadow-none gap-3 bg-gradient-to-br from-blue-900/30 to-blue-500/10">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600/20 text-purple-500">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <span className="text-xs text-muted-foreground">Completion Rate</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums">10%</span>
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950 p-0.5 rounded">
                        <ArrowUpRight className="h-3 w-3" />
                        5.0%
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
                {/* <TotalUsageCard /> */}
                <div className="col-span-1 md:col-span-1 lg:col-span-2">
                  <TodaysUsageCard selectedDateRange={dateRange} />
                </div>
                <TopKnowbyCard selectedDateRange={dateRange} />
              </div>
              {/* Knowby Stats + Heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
                <Card>
                  <CardHeader>
                    <CardTitle>Knowby Stats</CardTitle>
                    <CardDescription>Overview of Knowby activity and usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <KnowbyStats />
                  </CardContent>
                </Card>

                <Card className="bg-card text-card-foreground flex flex-col rounded-xl border">
                  <CardHeader>
                    <CardTitle>Calendar Heatmap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ViewsCalendarHeatmap />
                  </CardContent>
                </Card>
              </div>

              {/* Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
                <ModularGraphCard selectedDateRange={dateRange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Tabs>
  );
}
