"use client";

/* ============================================================================
   IMPORTS
   ============================================================================ */

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp, Activity, LucideGitCompareArrows } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  subDays,
  format,
  parse,
  isWithinInterval,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  isSameDay,
  differenceInCalendarDays,
  startOfYear,
  endOfYear,
  addYears,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { DateRange } from "react-day-picker";
import dynamic from "next/dynamic";
import { topChartOptions } from "@/lib/chartOptions";
import type { ApexOptions } from "apexcharts";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

/* ============================================================================
   TYPES
   ============================================================================ */

interface TodaysUsageCardProps {
  selectedDateRange: DateRange | undefined;
}

type DailyRow = {
  date: string;
  ts: number;
  Completions: number;
  Views: number;
};

type WindowKind = "day" | "week" | "month" | "year" | "custom";
type BucketMode = "daily" | "monthly" | "yearly";

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function TodaysUsageCard({ selectedDateRange }: TodaysUsageCardProps) {
  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */
  const [sevenDayCompletionRate, setSevenDayCompletionRate] = useState<number | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [prevDailyData, setPrevDailyData] = useState<DailyRow[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const isDark = useDarkMode();
  const [today] = useState(() => new Date());
  const { completions, views, status } = useKnowbyData();

  /* --------------------------------------------------------------------------
     DATE RANGE (CURRENT SELECTION)
     -------------------------------------------------------------------------- */
  const endDate = selectedDateRange?.to ?? today;
  const startDate = useMemo(
    () => selectedDateRange?.from ?? subDays(endDate, 6),
    [selectedDateRange?.from, endDate]
  );

  const startMs = useMemo(() => new Date(startDate).setHours(0, 0, 0, 0), [startDate]);
  const endMs = useMemo(() => new Date(endDate).setHours(23, 59, 59, 999), [endDate]);

  /* --------------------------------------------------------------------------
     DATA SPAN & RANGE INTERPRETATION
     -------------------------------------------------------------------------- */
  const dataMinMax = useMemo(() => {
    const parseD = (ds: string) => parse(ds, "dd/MM/yyyy", new Date());
    let min: Date | null = null;
    let max: Date | null = null;

    const bump = (d: Date) => {
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    };

    for (const r of completions) {
      const ds = (r as any)?.date;
      if (ds) bump(parseD(ds));
    }
    for (const r of views) {
      const ds = (r as any)?.date;
      if (ds) bump(parseD(ds));
    }

    return { min: min ?? startOfYear(today), max: max ?? endOfYear(today) };
  }, [completions, views, today]);

  const isAllTime = useMemo(
    () => isSameDay(startDate, dataMinMax.min) && isSameDay(endDate, dataMinMax.max),
    [startDate, endDate, dataMinMax]
  );

  const spanDays = useMemo(
    () => differenceInCalendarDays(endDate, startDate) + 1,
    [startDate, endDate]
  );

  const bucketMode = useMemo<BucketMode>(() => {
    if (spanDays > 1300) return "yearly";
    if (spanDays > 92) return "monthly";
    return "daily";
  }, [spanDays]);

  const titleText = useMemo(() => {
    if (isAllTime) return "All-time Usage";
    if (isSameDay(startDate, endDate)) return "Day's Usage";
    if (spanDays <= 8) return "Week's Usage";
    if (spanDays <= 32) return "Month's Usage";
    if (spanDays <= 370) return "Year's Usage";
    return "Selected Range Usage";
  }, [isAllTime, startDate, endDate, spanDays]);

  const windowKind = useMemo<WindowKind>(() => {
    const weekStart = startOfWeek(endDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(endDate, { weekStartsOn: 1 });

    if (isSameDay(startDate, endDate)) return "day";

    if (
      isSameDay(startDate, startOfMonth(startDate)) &&
      isSameDay(endDate, endOfMonth(startDate)) &&
      isSameDay(startOfMonth(startDate), startOfMonth(endDate))
    ) {
      return "month";
    }

    if (
      isSameDay(startDate, startOfYear(startDate)) &&
      isSameDay(endDate, endOfYear(startDate)) &&
      isSameDay(startOfYear(startDate), startOfYear(endDate))
    ) {
      return "year";
    }

    if (isSameDay(startDate, weekStart) && isSameDay(endDate, weekEnd)) return "week";
    return "custom";
  }, [startDate, endDate]);

  const datesToDisplay = useMemo<string[]>(() => {
    if (bucketMode === "daily") {
      return eachDayOfInterval({ start: new Date(startMs), end: new Date(endMs) }).map((d) =>
        format(d, "dd/MM/yyyy")
      );
    }
    if (bucketMode === "monthly") {
      const startM = startOfMonth(startDate);
      const endM = endOfMonth(endDate);
      const labels: string[] = [];
      let cur = startOfMonth(startM);
      while (cur <= endM) {
        labels.push(format(cur, "MMM yyyy"));
        cur = addMonths(cur, 1);
      }
      return labels;
    }
    // yearly
    const startY = startOfYear(startDate);
    const endY = endOfYear(endDate);
    const labels: string[] = [];
    let cur = startOfYear(startY);
    while (cur <= endY) {
      labels.push(format(cur, "yyyy"));
      cur = addYears(cur, 1);
    }
    return labels;
  }, [bucketMode, startMs, endMs, startDate, endDate]);

  const datesKey = useMemo(() => `${startMs}-${endMs}-${bucketMode}`, [startMs, endMs, bucketMode]);

  /* --------------------------------------------------------------------------
     PREVIOUS COMPARABLE RANGE (LABEL + DATES)
     -------------------------------------------------------------------------- */
  const previousRange = useMemo((): { from: Date; to: Date; label: string } => {
    if (windowKind === "day") {
      return { from: subDays(startDate, 1), to: subDays(endDate, 1), label: "yesterday" };
    }
    if (windowKind === "week") {
      return { from: subDays(startDate, 7), to: subDays(endDate, 7), label: "last week" };
    }
    if (windowKind === "month") {
      const from = startOfMonth(addMonths(startDate, -1));
      const to = endOfMonth(addMonths(startDate, -1));
      return { from, to, label: "last month" };
    }
    if (windowKind === "year") {
      const from = startOfYear(addYears(startDate, -1));
      const to = endOfYear(addYears(startDate, -1));
      return { from, to, label: "last year" };
    }
    const len = differenceInCalendarDays(endDate, startDate) + 1;
    const to = subDays(startDate, 1);
    const from = subDays(to, len - 1);
    return { from, to, label: "previous period" };
  }, [windowKind, startDate, endDate]);

  /* --------------------------------------------------------------------------
     COMPARISON STATE
     -------------------------------------------------------------------------- */
  const [compareLabel, setCompareLabel] = useState<string>("");
  const [deltaRate, setDeltaRate] = useState<number | null>(null);
  const [prevRate, setPrevRate] = useState<number | null>(null);

  /* ============================================================================
     EFFECT: BUILD CURRENT & PREVIOUS SERIES + RATES
     ============================================================================ */
  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;

    try {
      const dateCounts: Record<string, { completions: number; views: number }> = {};
      for (const label of datesToDisplay) dateCounts[label] = { completions: 0, views: 0 };

      const keyFor = (ds: string) => {
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (bucketMode === "daily") return format(d, "dd/MM/yyyy");
        if (bucketMode === "monthly") return format(d, "MMM yyyy");
        return format(d, "yyyy");
      };

      for (const row of completions) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(rowDate, { start: new Date(startMs), end: new Date(endMs) })) continue;
        const key = keyFor(ds);
        if (dateCounts[key]) dateCounts[key].completions += 1;
      }

      for (const row of views) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(rowDate, { start: new Date(startMs), end: new Date(endMs) })) continue;
        const key = keyFor(ds);
        if (dateCounts[key]) dateCounts[key].views += 1;
      }

      const rows: DailyRow[] = datesToDisplay.map((label) => {
        const ts =
          bucketMode === "daily"
            ? parse(label, "dd/MM/yyyy", new Date()).getTime()
            : bucketMode === "monthly"
              ? parse(`01 ${label}`, "dd MMM yyyy", new Date()).getTime()
              : parse(`01 Jan ${label}`, "dd MMM yyyy", new Date()).getTime();

        return {
          date:
            bucketMode === "daily"
              ? format(new Date(ts), "EEE")
              : label,
          ts,
          Completions: dateCounts[label]?.completions ?? 0,
          Views: dateCounts[label]?.views ?? 0,
        };
      });

      if (cancelled) return;
      setDailyData(rows);

      const totalC = rows.reduce((s, r) => s + r.Completions, 0);
      const totalV = rows.reduce((s, r) => s + r.Views, 0);
      const curRate = totalV > 0 ? parseFloat(((totalC / totalV) * 100).toFixed(2)) : null;
      setSevenDayCompletionRate(curRate);

      const prevFrom = new Date(previousRange.from.setHours(0, 0, 0, 0));
      const prevTo = new Date(previousRange.to.setHours(23, 59, 59, 999));

      const prevDateCounts: Record<string, { completions: number; views: number }> = {};
      const prevLabels: string[] =
        bucketMode === "daily"
          ? eachDayOfInterval({ start: prevFrom, end: prevTo }).map((d) => format(d, "dd/MM/yyyy"))
          : bucketMode === "monthly"
            ? (() => {
              const startM = startOfMonth(prevFrom);
              const endM = endOfMonth(prevTo);
              const labels: string[] = [];
              let cur = startOfMonth(startM);
              while (cur <= endM) {
                labels.push(format(cur, "MMM yyyy"));
                cur = addMonths(cur, 1);
              }
              return labels;
            })()
            : (() => {
              const startY = startOfYear(prevFrom);
              const endY = endOfYear(prevTo);
              const labels: string[] = [];
              let cur = startOfYear(startY);
              while (cur <= endY) {
                labels.push(format(cur, "yyyy"));
                cur = addYears(cur, 1);
              }
              return labels;
            })();

      for (const label of prevLabels) prevDateCounts[label] = { completions: 0, views: 0 };

      const prevKeyFor = (d: Date) => {
        if (bucketMode === "daily") return format(d, "dd/MM/yyyy");
        if (bucketMode === "monthly") return format(d, "MMM yyyy");
        return format(d, "yyyy");
      };

      for (const row of completions) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(d, { start: prevFrom, end: prevTo })) continue;
        const key = prevKeyFor(d);
        if (prevDateCounts[key]) prevDateCounts[key].completions += 1;
      }

      for (const row of views) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(d, { start: prevFrom, end: prevTo })) continue;
        const key = prevKeyFor(d);
        if (prevDateCounts[key]) prevDateCounts[key].views += 1;
      }

      const prevRowsNative: DailyRow[] = prevLabels.map((label) => {
        const ts =
          bucketMode === "daily"
            ? parse(label, "dd/MM/yyyy", new Date()).getTime()
            : bucketMode === "monthly"
              ? parse(`01 ${label}`, "dd MMM yyyy", new Date()).getTime()
              : parse(`01 Jan ${label}`, "dd MMM yyyy", new Date()).getTime();

        return {
          date: bucketMode === "daily" ? format(new Date(ts), "EEE") : label,
          ts,
          Completions: prevDateCounts[label]?.completions ?? 0,
          Views: prevDateCounts[label]?.views ?? 0,
        };
      });

      const prevRowsAligned: DailyRow[] = rows.map((curRow, i) => {
        const src = prevRowsNative[i];
        return {
          date: curRow.date,
          ts: curRow.ts,
          Completions: src ? src.Completions : 0,
          Views: src ? src.Views : 0,
        };
      });

      setPrevDailyData(prevRowsAligned);

      let pC = 0,
        pV = 0;
      for (const row of completions) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (isWithinInterval(d, { start: prevFrom, end: prevTo })) pC += 1;
      }
      for (const row of views) {
        const ds = (row as any)?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (isWithinInterval(d, { start: prevFrom, end: prevTo })) pV += 1;
      }

      const pRate = pV > 0 ? parseFloat(((pC / pV) * 100).toFixed(2)) : null;

      setPrevRate(pRate);
      setCompareLabel(previousRange.label);
      setDeltaRate(curRate != null && pRate != null ? parseFloat((curRate - pRate).toFixed(2)) : null);
    } catch (e) {
      console.error("Failed to compute window stats", e);
    }

    return () => {
      cancelled = true;
    };
  }, [
    datesKey,
    startDate,
    endDate,
    datesToDisplay,
    completions,
    views,
    status,
    startMs,
    endMs,
    bucketMode,
    previousRange,
  ]);

  /* --------------------------------------------------------------------------
     CHART SERIES & OPTIONS
     -------------------------------------------------------------------------- */
  const series = useMemo(() => {
    const base = [
      { name: "Views", data: dailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
      { name: "Completions", data: dailyData.map((r) => [r.ts, r.Completions]) as [number, number][] },
    ];

    if (showCompare && prevDailyData.length) {
      base.push(
        { name: `Views (${compareLabel})`, data: prevDailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
        { name: `Completions (${compareLabel})`, data: prevDailyData.map((r) => [r.ts, r.Completions]) as [number, number][] }
      );
    }

    return base;
  }, [dailyData, prevDailyData, showCompare, compareLabel]);

  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);
    const xLabelFormat = bucketMode === "yearly" ? "yyyy" : bucketMode === "monthly" ? "MMM yyyy" : "dd MMM";

    return {
      ...base,
      chart: { ...(base.chart ?? {}), redrawOnParentResize: true, redrawOnWindowResize: false },
      xaxis: { ...(base.xaxis ?? {}), type: "datetime", labels: { ...(base.xaxis?.labels ?? {}), format: xLabelFormat } },
      tooltip: { ...(base.tooltip ?? {}), x: { format: xLabelFormat }, theme: isDark ? "dark" : "light" },
      grid: { ...(base.grid ?? {}), padding: { ...base.grid?.padding, right: 8 } },
    };
  }, [isDark, bucketMode]);

  /* --------------------------------------------------------------------------
     AGGREGATES FOR FOOTER
     -------------------------------------------------------------------------- */
  const totalCompletions = dailyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.Views, 0);
  const isRefreshing = status === "refreshing";

  /* --------------------------------------------------------------------------
     DELTA BADGE (COMPARISON)
     -------------------------------------------------------------------------- */
  const deltaBadge =
    deltaRate == null ? (
      <span className="text-xs text-muted-foreground">vs {compareLabel}</span>
    ) : (
      <span
        className={
          "text-xs font-medium inline-flex items-center gap-1 " +
          (deltaRate > 0 ? "text-green-600" : deltaRate < 0 ? "text-red-600" : "text-muted-foreground")
        }
        title={`Prev rate: ${prevRate ?? "--"}%\nDifference: ${deltaRate > 0 ? "+" : ""}${deltaRate}%`}
      >
        {deltaRate > 0 ? "▲" : deltaRate < 0 ? "▼" : "•"} {Math.abs(deltaRate).toFixed(2)}%{" "}
        <span className="text-muted-foreground">vs {compareLabel}</span>
      </span>
    );

  /* ============================================================================
     JSX
     ============================================================================ */
  if (status === "loading") {
    return (
      <Card className="relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card">
        <div className="flex items-center gap-4">
          <div className="shrink-0 w-16 h-16 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[145px] rounded-md bg-muted animate-pulse" />
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="flex flex-col px-6 py-4 rounded-3xl h-fit gap-3 border-0 dark:border dark:border-slate-700 shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 w-full bg-card">
        {/* -------------------------------- HEADER -------------------------------- */}
        <div className="flex items-start justify-between">
          {/* Left */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full text-white bg-gradient-to-b from-rose-400 to-rose-700">
              <Activity className="h-8 w-8" />
            </div>

            <div className="flex flex-col gap-0 w-full min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold dark:text-white">{titleText}</h3>
                {isRefreshing && <span className="text-xs text-muted-foreground">Refreshing…</span>}
              </div>

              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-bold leading-none dark:text-white">
                  {sevenDayCompletionRate !== null ? `${Math.round(sevenDayCompletionRate)}%` : "--%"}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  {deltaBadge}
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col items-end gap-2 pt-2">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="text-xs text-muted-foreground">Views</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-xs text-muted-foreground">Completions</span>
              </div>
            </div>

            <button
              onClick={() => setShowCompare((v) => !v)}
              className={`inline-flex text-xs hover:cursor-pointer font-semibold items-center gap-1 rounded-full px-2.5 py-1 ring-1
              ${"bg-indigo-100 text-indigo-700 ring-indigo-200 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-white/10 hover:dark:bg-indigo-500/50"}`}
              title={`Toggle comparison with ${compareLabel}`}
            >
              <LucideGitCompareArrows className="h-3.5 w-3.5" />
              {showCompare ? "Hide Compare" : `Compare ${compareLabel}`}
            </button>
          </div>
        </div>

        <hr className="border-border" />

        {/* -------------------------------- CHART -------------------------------- */}
        <CardContent className="p-0 flex-1">
          <div className="h-[205px] -mt-5">
            <Chart options={options} series={series} type="area" height="100%" />
          </div>
        </CardContent>

        {/* -------------------------------- FOOTER ------------------------------- */}
        <div className="pl-6 pr-6">
          <CardFooter className="flex items-center justify-between text-muted-foreground text-xs px-20 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{totalViews}</strong> views
                </span>
              </TooltipTrigger>
              <TooltipContent>Total Views for Selected Period</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{totalCompletions}</strong> completions
                </span>
              </TooltipTrigger>
              <TooltipContent>Total Completions for Selected Period</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <strong className="text-foreground">
                    {sevenDayCompletionRate !== null ? `${sevenDayCompletionRate.toFixed(2)}%` : "--%"}
                  </strong>{" "}
                  comp. rate
                </span>
              </TooltipTrigger>
              <TooltipContent>Completion Rate for Selected Period</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
