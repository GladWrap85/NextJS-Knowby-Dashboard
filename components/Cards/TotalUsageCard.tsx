"use client";

// ---------------- Imports ----------------

import { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });


// ------------ HELPER FUNCTIONS ------------

// Helper function to parse date strings in "dd/MM/yyyy" format
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}
// Helper function to format month strings for charting
function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
// Helper function to convert month strings to timestamps
type MonthlyRow = {
  month: string;
  Completions: number;
  Views: number;
};


// ------------- MAIN COMPONENT -------------

export default function TotalUsageCard() {
  // State variables
  const [completionRate, setCompletionRate] = useState<number | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const isDark = useDarkMode();

  // Effect to fetch and parse CSV data
  useEffect(() => {
    let cancelled = false;

    const parseCsvText = (text: string) =>
      Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[];

    (async () => {
      try {
        // Load both files symultaneously
        const [compText, viewText] = await Promise.all([
          fetch("/scrapercompletions.csv").then(r => r.text()),
          fetch("/scraperviews.csv").then(r => r.text()),
        ]);

        const completions = parseCsvText(compText);
        const views = parseCsvText(viewText);

        const monthlyCounts: Record<string, { completions: number; views: number }> = {};

        // Load completions
        for (const row of completions) {
          if (!row.date) continue;
          const key = formatMonth(parseDate(row.date));
          (monthlyCounts[key] ??= { completions: 0, views: 0 }).completions++;
        }

        // Load views
        for (const row of views) {
          if (!row.date) continue;
          const key = formatMonth(parseDate(row.date));
          (monthlyCounts[key] ??= { completions: 0, views: 0 }).views++;
        }

        const data: MonthlyRow[] = Object.entries(monthlyCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, { completions, views }]) => ({
            month,
            Completions: completions,
            Views: views,
          }));

        if (cancelled) return;

        setMonthlyData(data);

        // Calculate overall completion rate
        const totalCompletions = data.reduce((s, d) => s + d.Completions, 0);
        const totalViews = data.reduce((s, d) => s + d.Views, 0);
        setCompletionRate(totalViews > 0 ? (totalCompletions / totalViews) * 100 : null);
      } catch (err) {
        console.error("Failed to load CSVs", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  // ----------- DATA PREPARATION -----------

  // Prepare data for chart and display
  const totalCompletions = monthlyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = monthlyData.reduce((sum, d) => sum + d.Views, 0);
  // Format the completion rate for display
  const roundedDisplayRate = completionRate !== null ? `${Math.round(completionRate)}%` : "--";
  const preciseDisplayRate = completionRate !== null ? `${completionRate.toFixed(2)}%` : "--";
  // Convert month strings to timestamps for charting
  const toTs = (ym: string) => new Date(`${ym}-01T00:00:00`).getTime();
  // Prepare series data for the chart
  const series = useMemo(
    () => [
      { name: "Views",        data: monthlyData.map(d => [toTs(d.month), d.Views]) as [number, number][] },
      { name: "Completions",  data: monthlyData.map(d => [toTs(d.month), d.Completions]) as [number, number][] },
    ],
    [monthlyData]
  );



  // ----------------- JSX -----------------

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        {/* Card header */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-lg text-white bg-gradient-to-b from-green-500 to-green-700">
            <TrendingUp className="h-8 w-8" />
          </div>
          {/* Title and completion rate */}
          <div className="flex flex-col gap-1 w-full">
            <h3 className="text-lg font-semibold">Total Usage</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">
                {roundedDisplayRate}
              </div>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </div>
          </div>
        </div>

        <hr className="border-border" />
        {/* Apex chart */}
        <CardContent className="p-0">
          <div className="h-[145px]">
            <ReactApexChart
              options={topChartOptions(isDark)}
              series={series}
              type="area"
              height={150}
            />
          </div>
        </CardContent>

        <div className="pl-6 pr-6">
          <div className="flex justify-center">
            <p className="text-xs font-semibold">Completions vs Views per Month</p>
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
