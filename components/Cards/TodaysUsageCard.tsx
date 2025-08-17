"use client";

// ---------------- Imports ----------------

import { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { subDays, format, parse, isWithinInterval, eachDayOfInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { topChartOptions } from "@/lib/chartOptions";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });


// ------------ HELPER FUNCTIONS ------------

interface TodaysUsageCardProps {
  selectedDateRange: DateRange | undefined;
}

type DailyRow = {
  date: string;
  ts: number;
  Completions: number;
  Views: number;
};


// -------------- MAIN COMPONENT -------------

export default function TodaysUsageCard({ selectedDateRange }: TodaysUsageCardProps) {
  const [completionRate, setCompletionRate] = useState<number | null>(null);
  const [sevenDayCompletionRate, setSevenDayCompletionRate] = useState<number | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const isDark = useDarkMode();

  const effectiveEndDate = selectedDateRange?.to || new Date();
  const effectiveStartDate = subDays(effectiveEndDate, 6);

  const datesToDisplay = useMemo(
    () =>
      eachDayOfInterval({ start: effectiveStartDate, end: effectiveEndDate }).map((d) =>
        format(d, "dd/MM/yyyy")
      ),
    [effectiveStartDate, effectiveEndDate]
  );

  useEffect(() => {
    let cancelled = false;

    const parseCsvText = (text: string) =>
      Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[];

    (async () => {
      try {
        const [compText, viewText] = await Promise.all([
          fetch("/completions.csv").then((r) => r.text()),
          fetch("/views.csv").then((r) => r.text()),
        ]);

        if (cancelled) return;

        const completions = parseCsvText(compText);
        const views = parseCsvText(viewText);

        const dateCounts: Record<string, { completions: number; views: number }> = {};
        for (const dateStr of datesToDisplay) {
          dateCounts[dateStr] = { completions: 0, views: 0 };
        }

        let latestDayCompletions = 0;
        let latestDayViews = 0;
        const latestDayFormatted = format(effectiveEndDate, "dd/MM/yyyy");

        // Tally completions
        for (const row of completions) {
          if (!row?.date) continue;
          const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
          if (isWithinInterval(rowDate, { start: effectiveStartDate, end: effectiveEndDate })) {
            const key = format(rowDate, "dd/MM/yyyy");
            if (dateCounts[key]) dateCounts[key].completions += 1;
            if (key === latestDayFormatted) latestDayCompletions += 1;
          }
        }

        // Tally views
        for (const row of views) {
          if (!row?.date) continue;
          const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
          if (isWithinInterval(rowDate, { start: effectiveStartDate, end: effectiveEndDate })) {
            const key = format(rowDate, "dd/MM/yyyy");
            if (dateCounts[key]) dateCounts[key].views += 1;
            if (key === latestDayFormatted) latestDayViews += 1;
          }
        }

        if (cancelled) return;

        setCompletionRate(
          latestDayViews > 0 ? parseFloat(((latestDayCompletions / latestDayViews) * 100).toFixed(2)) : null
        );

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

        const totalC = rows.reduce((s, r) => s + r.Completions, 0);
        const totalV = rows.reduce((s, r) => s + r.Views, 0);
        setSevenDayCompletionRate(totalV > 0 ? parseFloat(((totalC / totalV) * 100).toFixed(2)) : null);
      } catch (e) {
        console.error("Failed to load CSVs", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [datesToDisplay, effectiveStartDate, effectiveEndDate]);

  const series = useMemo(
    () => [
      { name: "Views", data: dailyData.map((r) => [r.ts, r.Views]) as [number, number][] },
      { name: "Completions", data: dailyData.map((r) => [r.ts, r.Completions]) as [number, number][] },
    ],
    [dailyData]
  );

  const totalCompletions = dailyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.Views, 0);
  

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
            <h3 className="text-lg font-semibold">Week's Usage</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">
                {completionRate !== null ? `${Math.round(completionRate)}%` : "--%"}
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
