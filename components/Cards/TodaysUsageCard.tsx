"use client";

// ---------------- Imports ----------------



import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp, Activity } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
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
  endOfWeek
} from "date-fns";
import { DateRange } from "react-day-picker";
import dynamic from "next/dynamic";
import { topChartOptions } from "@/lib/chartOptions";
import { ApexOptions } from "apexcharts";
import { useKnowbyData } from "@/lib/KnowbyDataProvider"; // <-- use shared data
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });


// ------------ HELPER FUNCTIONS ------------

// Type for the props of the TodaysUsageCard component
interface TodaysUsageCardProps {
  selectedDateRange: DateRange | undefined;
}

// Type for daily data rows
type DailyRow = {
  date: string;
  ts: number;
  Completions: number;
  Views: number;
};

// --- NEW: types for comparison badge ---
type WindowKind = "day" | "week" | "month" | "year" | "custom";


// -------------- MAIN COMPONENT -------------

export default function TodaysUsageCard({ selectedDateRange }: TodaysUsageCardProps) {
  // State variables
  const [sevenDayCompletionRate, setSevenDayCompletionRate] = useState<number | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const isDark = useDarkMode();
  // Default to today if no date range is selected
  const [today] = useState(() => new Date());

  const [showCompare, setShowCompare] = useState(false);
  const [prevDailyData, setPrevDailyData] = useState<DailyRow[]>([]);

  // Calculate the start and end dates
  const endDate = selectedDateRange?.to ?? today;
  const startDate = useMemo(() => selectedDateRange?.from ?? subDays(endDate, 6), [selectedDateRange?.from, endDate]);

  // Effect to fetch and parse CSV data
  const { completions, views, status } = useKnowbyData(); // read shared arrays + status

  // -------- NEW: compute full data-span (min/max date found in data) --------
  const dataMinMax = useMemo(() => {
    const parseD = (ds: string) => parse(ds, "dd/MM/yyyy", new Date());
    let min: Date | null = null, max: Date | null = null;
    const bump = (d: Date) => {
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    };
    for (const r of completions) { const ds = (r as any)?.date; if (ds) bump(parseD(ds)); }
    for (const r of views) { const ds = (r as any)?.date; if (ds) bump(parseD(ds)); }
    return { min: min ?? startOfYear(today), max: max ?? endOfYear(today) };
  }, [completions, views, today]);

  // -------- NEW: detect “All-time” selection (range equals data span) --------
  const isAllTime = useMemo(() => {
    return isSameDay(startDate, dataMinMax.min) && isSameDay(endDate, dataMinMax.max);
  }, [startDate, endDate, dataMinMax]);

  // -------- NEW: infer “period” from the selected window --------
  const spanDays = useMemo(
    () => differenceInCalendarDays(endDate, startDate) + 1,
    [startDate, endDate]
  );

  // For short ranges chart daily; medium → monthly; long → yearly
  type BucketMode = "daily" | "monthly" | "yearly";
  const bucketMode = useMemo<BucketMode>(() => {
    if (spanDays > 1300) return "yearly";      // ~3.5y+
    if (spanDays > 92) return "monthly";       // >3 months
    return "daily";
  }, [spanDays]);

  // Title label to match the range user chose at the top
  const titleText = useMemo(() => {
    if (isAllTime) return "All-time Usage";
    if (isSameDay(startDate, endDate)) return "Day's Usage";
    if (spanDays <= 8) return "Week's Usage";
    if (spanDays <= 32) return "Month's Usage";
    if (spanDays <= 370) return "Year's Usage";
    return "Selected Range Usage";
  }, [isAllTime, startDate, endDate, spanDays]);

  // --- NEW: identify exact calendar window kind (so we can compare to previous instance) ---
  const windowKind = useMemo<WindowKind>(() => {
    const weekStart = startOfWeek(endDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(endDate, { weekStartsOn: 1 });
    if (isSameDay(startDate, endDate)) return "day";
    if (isSameDay(startDate, startOfMonth(startDate)) && isSameDay(endDate, endOfMonth(startDate)) && isSameDay(startOfMonth(startDate), startOfMonth(endDate))) {
      return "month";
    }
    if (isSameDay(startDate, startOfYear(startDate)) && isSameDay(endDate, endOfYear(startDate)) && isSameDay(startOfYear(startDate), startOfYear(endDate))) {
      return "year";
    }
    if (isSameDay(startDate, weekStart) && isSameDay(endDate, weekEnd)) return "week";
    return "custom";
  }, [startDate, endDate]);

  // Subtitle text for the chart footer
  const subtitleText = useMemo(() => {
    if (bucketMode === "yearly") return "Completions vs Views per Year";
    if (bucketMode === "monthly") return "Completions vs Views per Month";
    return spanDays <= 8
      ? "Completions vs Views over the Past 7 Days"
      : "Completions vs Views per Day";
  }, [bucketMode, spanDays]);

  // Convert start and end dates to milliseconds for easier calculations
  const startMs = useMemo(() => new Date(startDate).setHours(0, 0, 0, 0), [startDate]);
  const endMs = useMemo(() => new Date(endDate).setHours(23, 59, 59, 999), [endDate]);

  // -------- NEW: build display buckets based on bucketMode --------
  const datesToDisplay = useMemo<string[]>(() => {
    if (bucketMode === "daily") {
      // daily buckets across the selected range
      return eachDayOfInterval({
        start: new Date(startMs),
        end: new Date(endMs),
      }).map(d => format(d, "dd/MM/yyyy"));
    } else if (bucketMode === "monthly") {
      // monthly buckets from start month to end month
      const startM = startOfMonth(startDate);
      const endM = endOfMonth(endDate);
      const labels: string[] = [];
      let cur = startOfMonth(startM);
      while (cur <= endM) {
        labels.push(format(cur, "MMM yyyy")); // monthly key
        cur = addMonths(cur, 1);
      }
      return labels;
    } else {
      // yearly buckets from start year to end year
      const startY = startOfYear(startDate);
      const endY = endOfYear(endDate);
      const labels: string[] = [];
      let cur = startOfYear(startY);
      while (cur <= endY) {
        labels.push(format(cur, "yyyy")); // yearly key
        cur = addYears(cur, 1);
      }
      return labels;
    }
  }, [bucketMode, startMs, endMs, startDate, endDate]);

  // Create a unique key for the dates to avoid unnecessary re-renders
  const datesKey = useMemo(() => `${startMs}-${endMs}-${bucketMode}`, [startMs, endMs, bucketMode]);

  // --- NEW: helpers to build previous comparable window and compute totals ---
  const previousRange = useMemo((): { from: Date; to: Date; label: string } => {
    if (windowKind === "day") {
      const from = subDays(startDate, 1);
      const to = subDays(endDate, 1);
      return { from, to, label: "yesterday" };
    }
    if (windowKind === "week") {
      const from = subDays(startDate, 7);
      const to = subDays(endDate, 7);
      return { from, to, label: "last week" };
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
    // custom: previous window of same length
    const len = differenceInCalendarDays(endDate, startDate) + 1;
    const to = subDays(startDate, 1);
    const from = subDays(to, len - 1);
    return { from, to, label: "previous period" };
  }, [windowKind, startDate, endDate]);

  // --- NEW: comparison state ---
  const [compareLabel, setCompareLabel] = useState<string>(""); // e.g., "vs last month"
  const [deltaRate, setDeltaRate] = useState<number | null>(null); // currentRate - prevRate
  const [prevRate, setPrevRate] = useState<number | null>(null);

  useEffect(() => {
    if (status === "loading") return; // keep old data visible until first load completes

    let cancelled = false;

    try {
      const dateCounts: Record<string, { completions: number; views: number }> = {};
      for (const label of datesToDisplay) {
        dateCounts[label] = { completions: 0, views: 0 };
      }

      // helper to key a row into the right bucket
      const keyFor = (ds: string) => {
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (bucketMode === "daily") return format(d, "dd/MM/yyyy");
        if (bucketMode === "monthly") return format(d, "MMM yyyy");
        return format(d, "yyyy");
      };

      // Load completions from provider data
      for (const row of completions) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(rowDate, { start: new Date(startMs), end: new Date(endMs) })) continue;
        const key = keyFor(ds);
        if (dateCounts[key]) dateCounts[key].completions += 1;
      }

      // Load views from provider data
      for (const row of views) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(rowDate, { start: new Date(startMs), end: new Date(endMs) })) continue;
        const key = keyFor(ds);
        if (dateCounts[key]) dateCounts[key].views += 1;
      }

      if (cancelled) return;

      // Build rows for chart (x = ts; month = 1st of month; year = Jan 1)
      const rows: DailyRow[] = datesToDisplay.map((label) => {
        let ts: number;
        if (bucketMode === "daily") {
          const d = parse(label, "dd/MM/yyyy", new Date());
          ts = d.getTime();
        } else if (bucketMode === "monthly") {
          const d = parse(`01 ${label}`, "dd MMM yyyy", new Date()); // first day of month
          ts = d.getTime();
        } else {
          const d = parse(`01 Jan ${label}`, "dd MMM yyyy", new Date()); // Jan 1 of year
          ts = d.getTime();
        }
        return {
          date:
            bucketMode === "daily"
              ? format(new Date(ts), "EEE")
              : bucketMode === "monthly"
              ? label
              : label,
          ts,
          Completions: dateCounts[label]?.completions ?? 0,
          Views: dateCounts[label]?.views ?? 0,
        };
      });

      setDailyData(rows);

      // Calculate the completion rate for the selected window
      const totalC = rows.reduce((s, r) => s + r.Completions, 0);
      const totalV = rows.reduce((s, r) => s + r.Views, 0);
      const curRate = totalV > 0 ? parseFloat(((totalC / totalV) * 100).toFixed(2)) : null;
      setSevenDayCompletionRate(curRate);

      // --- compute previous-period totals & delta ---
      const prevFrom = new Date(previousRange.from.setHours(0, 0, 0, 0));
      const prevTo = new Date(previousRange.to.setHours(23, 59, 59, 999));

      // --- build previous-period rows, then align them to current x-axis ---
      const prevDateCounts: Record<string, { completions: number; views: number }> = {};
      // generate prev labels using the same bucketing rules, so arrays are the same length
      const prevLabels: string[] = (() => {
        if (bucketMode === "daily") {
          return eachDayOfInterval({
            start: new Date(prevFrom),
            end: new Date(prevTo),
          }).map(d => format(d, "dd/MM/yyyy"));
        } else if (bucketMode === "monthly") {
          const startM = startOfMonth(prevFrom);
          const endM = endOfMonth(prevTo);
          const labels: string[] = [];
          let cur = startOfMonth(startM);
          while (cur <= endM) {
            labels.push(format(cur, "MMM yyyy"));
            cur = addMonths(cur, 1);
          }
          return labels;
        } else {
          const startY = startOfYear(prevFrom);
          const endY = endOfYear(prevTo);
          const labels: string[] = [];
          let cur = startOfYear(startY);
          while (cur <= endY) {
            labels.push(format(cur, "yyyy"));
            cur = addYears(cur, 1);
          }
          return labels;
        }
      })();

      // zero-fill counts for previous labels
      for (const label of prevLabels) prevDateCounts[label] = { completions: 0, views: 0 };

      // helper for prev bucketing
      const prevKeyFor = (d: Date) => {
        if (bucketMode === "daily") return format(d, "dd/MM/yyyy");
        if (bucketMode === "monthly") return format(d, "MMM yyyy");
        return format(d, "yyyy");
      };

      // aggregate completions into previous period buckets
      for (const row of completions) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(d, { start: prevFrom, end: prevTo })) continue;
        const key = prevKeyFor(d);
        if (prevDateCounts[key]) prevDateCounts[key].completions += 1;
      }

      // aggregate views into previous period buckets
      for (const row of views) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (!isWithinInterval(d, { start: prevFrom, end: prevTo })) continue;
        const key = prevKeyFor(d);
        if (prevDateCounts[key]) prevDateCounts[key].views += 1;
      }

      // build previous rows (native timestamps of that period)
      const prevRowsNative: DailyRow[] = prevLabels.map((label) => {
        let ts: number;
        if (bucketMode === "daily") {
          ts = parse(label, "dd/MM/yyyy", new Date()).getTime();
        } else if (bucketMode === "monthly") {
          ts = parse(`01 ${label}`, "dd MMM yyyy", new Date()).getTime();
        } else {
          ts = parse(`01 Jan ${label}`, "dd MMM yyyy", new Date()).getTime();
        }
        return {
          date: bucketMode === "daily" ? format(new Date(ts), "EEE") : label,
          ts,
          Completions: prevDateCounts[label]?.completions ?? 0,
          Views: prevDateCounts[label]?.views ?? 0,
        };
      });

      // align previous rows to the *current* x-axis so the two lines overlap by position
      const prevRowsAligned: DailyRow[] = rows.map((curRow, i) => {
        const src = prevRowsNative[i];
        return {
          date: curRow.date,     // display label aligned to current bucket
          ts: curRow.ts,         // <--- critical: use current ts for overlay
          Completions: src ? src.Completions : 0,
          Views: src ? src.Views : 0,
        };
      });

      setPrevDailyData(prevRowsAligned);


      let pC = 0, pV = 0;
      for (const row of completions) {
        const ds = row?.date as string | undefined; if (!ds) continue;
        const d = parse(ds, "dd/MM/yyyy", new Date());
        if (isWithinInterval(d, { start: prevFrom, end: prevTo })) pC += 1;
      }
      for (const row of views) {
        const ds = row?.date as string | undefined; if (!ds) continue;
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
    // deps
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
    previousRange
  ]);


  // ----------- DATA PREPARATION -----------

  // Prepare the series data for the chart
  const series = useMemo(() => {
    const base = [
      { name: "Views", data: dailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
      { name: "Completions", data: dailyData.map((r) => [r.ts, r.Completions]) as [number, number][] },
    ];

    if (showCompare && prevDailyData.length) {
      base.push(
        { name: `Views (${compareLabel})`, data: prevDailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
        { name: `Completions (${compareLabel})`, data: prevDailyData.map((r) => [r.ts, r.Completions]) as [number, number][] },
      );
    }

    return base;
  }, [dailyData, prevDailyData, showCompare, compareLabel]);

  // Calculate the total completions and views for footer
  const totalCompletions = dailyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.Views, 0);

  // Prepare the chart options
  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);

    // date format for x-axis / tooltip depending on bucket
    const xLabelFormat =
      bucketMode === "yearly" ? "yyyy" :
      bucketMode === "monthly" ? "MMM yyyy" :
      "dd MMM";
    const tooltipFormat = xLabelFormat;

    return {
      ...base,
      chart: {
        ...(base.chart ?? {}),
        redrawOnParentResize: true,
        redrawOnWindowResize: false,
      },
      xaxis: {
        ...(base.xaxis ?? {}),
        type: "datetime",
        labels: {
          ...(base.xaxis?.labels ?? {}),
          format: xLabelFormat,
        },
      },
      tooltip: {
        ...(base.tooltip ?? {}),
        x: { format: tooltipFormat },
        theme: isDark ? "dark" : "light",
      },
      // small padding tweak so long labels don't clip
      grid: {
        ...(base.grid ?? {}),
        padding: { ...base.grid?.padding, right: 8 },
      },
    };
  }, [isDark, bucketMode]);

  if (status === "loading") {
    return (
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        <div className="flex items-center gap-4">
          <div className="shrink-0 w-16 h-16 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[145px] rounded-md bg-muted animate-pulse" />
      </Card>
    );
  }

  const isRefreshing = status === "refreshing";

  // ----------------- JSX -----------------

  // --- NEW: delta badge styling ---
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
        {deltaRate > 0 ? "▲" : deltaRate < 0 ? "▼" : "•"} {Math.abs(deltaRate).toFixed(2)}% <span className="text-muted-foreground">vs {compareLabel}</span>
      </span>
    );

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-3xl h-fit gap-3 border-0 dark:border dark:border-slate-700 shadow-xl/2 w-full bg-card min-h-[365px]">
        {/* Card header */}
        <div className="flex items-start justify-between">
          {/* LEFT SIDE */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full text-white bg-gradient-to-b from-rose-400 to-rose-700">
              <Activity className="h-8 w-8" />
            </div>

            <div className="flex flex-col gap-0 w-full min-w-0">
              <div className="flex items-center justify-between">
                {/* ---- dynamic title ---- */}
                <h3 className="text-lg font-semibold">{titleText}</h3>
                {isRefreshing && (
                  <span className="text-xs text-muted-foreground">Refreshing…</span>
                )}
              </div>

              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-bold leading-none">
                  {sevenDayCompletionRate !== null
                    ? `${Math.round(sevenDayCompletionRate)}%`
                    : "--%"}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  {deltaBadge}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 pt-2">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500"></span>
                <span className="text-xs text-muted-foreground">Views</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500"></span>
                <span className="text-xs text-muted-foreground">Completions</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCompare(v => !v)}
              className="text-xs px-2 py-1 rounded-md border hover:bg-muted transition-colors"
              title={`Toggle comparison with ${compareLabel}`}
            >
              {showCompare ? "Hide Compare" : `Compare ${compareLabel}`}
            </button>
          </div>

        </div>


        <hr className="border-border" />
        {/* Apex chart */}
        <CardContent className="p-0 flex-1">
          <div className="h-[205px] -mt-5">
            <Chart
              options={options}
              series={series}
              type="area"
              height="100%"
            />
          </div>
        </CardContent>

        <div className="pl-6 pr-6">
          {/* <div className="flex justify-center">
            <p className="text-xs font-semibold">{subtitleText}</p>
          </div> */}
          {/* Footer with tooltips for views and completions */}
          <CardFooter className="flex items-center justify-center gap-56 text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{totalViews}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Views for Selected Period</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>{totalCompletions}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Completions for Selected Period</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                  <span>{sevenDayCompletionRate !== null ? `${sevenDayCompletionRate.toFixed(2)}%` : "--%"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion Rate for Selected Period</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
