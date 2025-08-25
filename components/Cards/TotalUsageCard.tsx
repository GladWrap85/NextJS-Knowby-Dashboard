"use client";

import { useMemo, useDeferredValue } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dynamic from "next/dynamic";
import { topChartOptions } from "@/lib/chartOptions";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ---- Helpers
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}
function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
type MonthlyRow = { month: string; Completions: number; Views: number };

export default function TotalUsageCard() {
  const isDark = useDarkMode();
  const { completions, views, status } = useKnowbyData(); // status: "loading" | "ready" | "refreshing" | "error"

  // Derive monthly rows from provider data
  const monthlyData: MonthlyRow[] = useMemo(() => {
    const monthlyCounts: Record<string, { completions: number; views: number }> = {};
    for (const row of completions) {
      const ds = row?.date;
      if (!ds) continue;
      const key = formatMonth(parseDate(ds));
      (monthlyCounts[key] ??= { completions: 0, views: 0 }).completions++;
    }
    for (const row of views) {
      const ds = row?.date;
      if (!ds) continue;
      const key = formatMonth(parseDate(ds));
      (monthlyCounts[key] ??= { completions: 0, views: 0 }).views++;
    }
    return Object.entries(monthlyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { completions, views }]) => ({
        month,
        Completions: completions,
        Views: views,
      }));
  }, [completions, views]);

  // Keep UI super smooth by deferring heavy updates a tick
  const deferredMonthly = useDeferredValue(monthlyData);

  const completionRate: number | null = useMemo(() => {
    const tc = deferredMonthly.reduce((s, d) => s + d.Completions, 0);
    const tv = deferredMonthly.reduce((s, d) => s + d.Views, 0);
    return tv > 0 ? (tc / tv) * 100 : null;
  }, [deferredMonthly]);

  // Prepare chart
  const toTs = (ym: string) => new Date(`${ym}-01T00:00:00`).getTime();

  const series = useMemo(
    () => [
      { name: "Views", data: deferredMonthly.map(d => [toTs(d.month), d.Views]) as [number, number][] },
      { name: "Completions", data: deferredMonthly.map(d => [toTs(d.month), d.Completions]) as [number, number][] },
    ],
    [deferredMonthly]
  );

  const options = useMemo(() => {
    const base = topChartOptions(isDark);
    return {
      ...base,
      chart: {
        ...(base.chart ?? {}),
        redrawOnParentResize: true,
        redrawOnWindowResize: false,
      },
    };
  }, [isDark]);

  const totalCompletions = deferredMonthly.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = deferredMonthly.reduce((sum, d) => sum + d.Views, 0);
  const roundedDisplayRate = completionRate !== null ? `${Math.round(completionRate)}%` : "--";
  const preciseDisplayRate = completionRate !== null ? `${completionRate.toFixed(2)}%` : "--";

  // Only show skeleton on very first load; keep chart during "refreshing"
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

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-lg text-white bg-gradient-to-b from-green-500 to-green-700">
            <TrendingUp className="h-8 w-8" />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Total Usage</h3>
              {isRefreshing && (
                <span className="text-xs text-muted-foreground">Refreshing…</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">{roundedDisplayRate}</div>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Chart */}
        <CardContent className="p-0 overflow-hidden">
          <div className="h-[145px] ">
            <ReactApexChart options={options} series={series} type="area" height={150} />
          </div>
        </CardContent>

        {/* Footer */}
        <div className="pl-6 pr-6">
          <div className="flex justify-center">
            <p className="text-xs font-semibold">Completions vs Views per Month</p>
          </div>
          <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{totalViews}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Views</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>{totalCompletions}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Completions</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  <span>{preciseDisplayRate}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion Rate</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
