"use client";

// ---------------- Imports ----------------

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp } from "lucide-react";
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
  eachDayOfInterval
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


// -------------- MAIN COMPONENT -------------

export default function TodaysUsageCard({ selectedDateRange }: TodaysUsageCardProps) {
  // State variables
  const [sevenDayCompletionRate, setSevenDayCompletionRate] = useState<number | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const isDark = useDarkMode();
  // Default to today if no date range is selected
  const [today] = useState(() => new Date());

  // Calculate the start and end dates
  const endDate = selectedDateRange?.to ?? today;
  const startDate = useMemo(() => subDays(endDate, 6), [endDate]);

  // Convert start and end dates to milliseconds for easier calculations
  const startMs = useMemo(() => new Date(startDate).setHours(0, 0, 0, 0), [startDate]);
  const endMs = useMemo(() => new Date(endDate).setHours(23, 59, 59, 999), [endDate]);

  // Generate an array of dates to display
  const datesToDisplay = useMemo<string[]>(() => {
    return eachDayOfInterval({
      start: new Date(startMs),
      end: new Date(endMs),
    }).map(d => format(d, "dd/MM/yyyy"));
  }, [startMs, endMs]);

  // Create a unique key for the dates to avoid unnecessary re-renders
  const datesKey = useMemo(() => `${startMs}-${endMs}`, [startMs, endMs]);

  // Effect to fetch and parse CSV data
  const { completions, views, status } = useKnowbyData(); // read shared arrays + status
  useEffect(() => {
    if (status === "loading") return; // keep old data visible until first load completes

    let cancelled = false;

    try {
      const dateCounts: Record<string, { completions: number; views: number }> = {};
      for (const dateStr of datesToDisplay) {
        dateCounts[dateStr] = { completions: 0, views: 0 };
      }

      let latestDayCompletions = 0;
      let latestDayViews = 0;
      const latestDayFormatted = format(endDate, "dd/MM/yyyy");

      // Load completions from provider data
      for (const row of completions) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (isWithinInterval(rowDate, { start: startDate, end: endDate })) {
          const key = format(rowDate, "dd/MM/yyyy");
          if (dateCounts[key]) dateCounts[key].completions += 1;
          if (key === latestDayFormatted) latestDayCompletions += 1;
        }
      }

      // Load views from provider data
      for (const row of views) {
        const ds = row?.date as string | undefined;
        if (!ds) continue;
        const rowDate = parse(ds, "dd/MM/yyyy", new Date());
        if (isWithinInterval(rowDate, { start: startDate, end: endDate })) {
          const key = format(rowDate, "dd/MM/yyyy");
          if (dateCounts[key]) dateCounts[key].views += 1;
          if (key === latestDayFormatted) latestDayViews += 1;
        }
      }

      if (cancelled) return;

      const rows: DailyRow[] = datesToDisplay.map((dateStr) => {
        const d = parse(dateStr, "dd/MM/yyyy", new Date());
        return {
          date: format(d, "EEE"),
          ts: d.getTime(),
          Completions: dateCounts[dateStr]?.completions ?? 0,
          Views: dateCounts[dateStr]?.views ?? 0,
        };
      });

      setDailyData(rows);

      // Calculate the 7-day completion rate
      const totalC = rows.reduce((s, r) => s + r.Completions, 0);
      const totalV = rows.reduce((s, r) => s + r.Views, 0);
      setSevenDayCompletionRate(totalV > 0 ? parseFloat(((totalC / totalV) * 100).toFixed(2)) : null);
    } catch (e) {
      console.error("Failed to compute weekly stats", e);
    }

    return () => {
      cancelled = true;
    };
  }, [datesKey, startDate, endDate, datesToDisplay, completions, views, status]);


  // ----------- DATA PREPARATION -----------

  // Prepare the series data for the chart
  const series = useMemo(
    () => [
      { name: "Views", data: dailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
      { name: "Completions", data: dailyData.map((r) => [r.ts, r.Completions]) as [number, number][] },
    ],
    [dailyData]
  );

  // Calculate the total completions and views for footer
  const totalCompletions = dailyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.Views, 0);

  // Prepare the chart options
  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);

    return {
      ...base,
      chart: {
        ...(base.chart ?? {}),
        redrawOnParentResize: true,
        redrawOnWindowResize: false,
      },
      xaxis: {
        ...(base.xaxis ?? {}),
        labels: {
          ...(base.xaxis?.labels ?? {}),
          format: 'dd MMM',
        },
      },
      tooltip: {
        ...(base.tooltip ?? {}),
        x: { format: "dd MMM" },
        theme: isDark ? "dark" : "light",
      },
    };
  }, [isDark]);

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

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        {/* Card header */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-lg text-white bg-gradient-to-b from-purple-500 to-purple-700">
            <TrendingUp className="h-8 w-8" />
          </div>
          {/* Title and completion rate */}
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Week's Usage</h3>
              {isRefreshing && (
                <span className="text-xs text-muted-foreground">Refreshing…</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">
                {sevenDayCompletionRate !== null ? `${Math.round(sevenDayCompletionRate)}%` : "--%"}
              </div>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </div>
          </div>
        </div>

        <hr className="border-border" />
        {/* Apex chart */}
        <CardContent className="p-0 overflow-hidden">
          <div className="h-[145px]">
            <Chart
              options={options}
              series={series}
              type="area"
              height={150}
            />
          </div>
        </CardContent>

        <div className="pl-6 pr-6">
          <div className="flex justify-center">
            <p className="text-xs font-semibold">Completions vs Views over the Past 7 Days</p>
          </div>
          {/* Footer with tooltips for views and completions */}
          <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{totalViews}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Views for Past 7 Days</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>{totalCompletions}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Completions for Past 7 Days</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  <span>{sevenDayCompletionRate !== null ? `${sevenDayCompletionRate.toFixed(2)}%` : "--%"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion Rate for Past 7 Days</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
