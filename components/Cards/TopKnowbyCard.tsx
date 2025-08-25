// components/Cards/TopKnowbyCard.tsx
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  subDays,
  format,
  parse,
  isWithinInterval,
  eachDayOfInterval,
  startOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { DateRange } from "react-day-picker";
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
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { ApexOptions } from "apexcharts";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface TopKnowbyCardProps {
  selectedDateRange: DateRange | undefined;
}

type DailyRow = { ts: number; views: number; completions: number; label: string };
type MonthlyRow = { ts: number; rate: number; label: string };


export default function TopKnowbyCard({ selectedDateRange }: TopKnowbyCardProps) {
  const [chartType, setChartType] = useState<"daily" | "monthly">("daily");
  const [topKnowby, setTopKnowby] = useState<string>("—");
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [totalsDaily, setTotalsDaily] = useState({ views: 0, comps: 0 });
  const [totalsMonthly, setTotalsMonthly] = useState({ views: 0, comps: 0 });
  const isDark = useDarkMode();

  const { completions, views, status } = useKnowbyData();

  // --- Time windows
  const effectiveEndDate = selectedDateRange?.to || new Date();
  const dailyStart = useMemo(() => subDays(effectiveEndDate, 9), [effectiveEndDate]);

  const dayKeys = useMemo(
    () =>
      eachDayOfInterval({ start: dailyStart, end: effectiveEndDate }).map((d) => ({
        label: format(d, "dd/MM/yyyy"),
        ts: d.getTime(),
      })),
    [dailyStart, effectiveEndDate]
  );

  const monthDates = useMemo(() => {
    const end = startOfMonth(effectiveEndDate);
    const start = subMonths(end, 11);
    const arr: Date[] = [];
    for (let i = 0; i < 12; i++) arr.push(addMonths(start, i));
    return arr;
  }, [effectiveEndDate]);

  const monthKeys = useMemo(
    () => monthDates.map((d) => ({ label: format(d, "MMM yyyy"), ts: d.getTime() })),
    [monthDates]
  );

  // --- Data load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Top knowby by completions
        const byKnowby: Record<string, number> = {};
        for (const row of completions) {
          const name = (row as any)?.knowby_name;
          if (!name) continue;
          byKnowby[name] = (byKnowby[name] ?? 0) + 1;
        }
        const top = Object.entries(byKnowby).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        if (cancelled) return;
        setTopKnowby(top);

        // 2) Daily (10d) counts
        const dayMap: Record<string, { views: number; comps: number }> = {};
        dayKeys.forEach(({ label }) => (dayMap[label] = { views: 0, comps: 0 }));

        for (const row of completions) {
          if ((row as any)?.knowby_name !== top || !(row as any)?.date) continue;
          const d = parse((row as any).date, "dd/MM/yyyy", new Date());
          if (isWithinInterval(d, { start: dailyStart, end: effectiveEndDate })) {
            dayMap[format(d, "dd/MM/yyyy")].comps++;
          }
        }
        for (const row of views) {
          if ((row as any)?.knowby_name !== top || !(row as any)?.date) continue;
          const d = parse((row as any).date, "dd/MM/yyyy", new Date());
          if (isWithinInterval(d, { start: dailyStart, end: effectiveEndDate })) {
            dayMap[format(d, "dd/MM/yyyy")].views++;
          }
        }

        const dailyRows: DailyRow[] = dayKeys.map(({ label, ts }) => ({
          ts,
          label,
          views: dayMap[label].views,
          completions: dayMap[label].comps,
        }));
        const dailyTotals = dailyRows.reduce(
          (acc, r) => ({ views: acc.views + r.views, comps: acc.comps + r.completions }),
          { views: 0, comps: 0 }
        );

        // 3) Monthly (12m) rate
        const monthMap: Record<string, { views: number; comps: number }> = {};
        monthKeys.forEach(({ label }) => (monthMap[label] = { views: 0, comps: 0 }));

        for (const row of completions) {
          if ((row as any)?.knowby_name !== top || !(row as any)?.date) continue;
          const key = format(parse((row as any).date, "dd/MM/yyyy", new Date()), "MMM yyyy");
          if (key in monthMap) monthMap[key].comps++;
        }
        for (const row of views) {
          if ((row as any)?.knowby_name !== top || !(row as any)?.date) continue;
          const key = format(parse((row as any).date, "dd/MM/yyyy", new Date()), "MMM yyyy");
          if (key in monthMap) monthMap[key].views++;
        }

        const monthlyTotals = Object.values(monthMap).reduce(
          (acc, v) => ({ views: acc.views + v.views, comps: acc.comps + v.comps }),
          { views: 0, comps: 0 }
        );

        const monthlyRows: MonthlyRow[] = monthKeys.map(({ label, ts }) => {
          const v = monthMap[label];
          const rate = v.views > 0 ? (v.comps / v.views) * 100 : 0;
          return { ts, label, rate: parseFloat(rate.toFixed(2)) };
        });

        if (cancelled) return;
        setDailyData(dailyRows);
        setMonthlyData(monthlyRows);
        setTotalsDaily(dailyTotals);
        setTotalsMonthly(monthlyTotals);
      } catch (e) {
        console.error("TopKnowbyCard load error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [completions, views, dayKeys, monthKeys, dailyStart, effectiveEndDate]);

  // ---- Series
  const series = useMemo(() => {
    if (chartType === "daily") {
      return [
        { name: "Views", data: dailyData.map((r) => [r.ts, r.views]) as [number, number][] },
        { name: "Completions", data: dailyData.map((r) => [r.ts, r.completions]) as [number, number][] },
      ];
    }
    return [{ name: "Completion Rate", data: monthlyData.map((r) => [r.ts, r.rate]) as [number, number][] }];
  }, [chartType, dailyData, monthlyData]);

  // ---- Headline + Footer stats
  const stats =
    chartType === "daily"
      ? {
        views: totalsDaily.views,
        comps: totalsDaily.comps,
        rate: totalsDaily.views > 0 ? (totalsDaily.comps / totalsDaily.views) * 100 : null,
        caption: `Daily Views & Completions for ${topKnowby} (last 10 days)`,
      }
      : {
        views: totalsMonthly.views,
        comps: totalsMonthly.comps,
        rate: totalsMonthly.views > 0 ? (totalsMonthly.comps / totalsMonthly.views) * 100 : null,
        caption: `Monthly Completion Rate for ${topKnowby} (last 12 months)`,
      };
  const headline = stats.rate !== null ? `${Math.round(stats.rate)}%` : "--%";

  // ========= SCROLLING BLUE TITLE (marquee) =========
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [maskCSS, setMaskCSS] = useState<string>("none");
  const [scrollPx, setScrollPx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [animDuration, setAnimDuration] = useState<string>("8s");

  const computeOverflow = useCallback(() => {
    const el = containerRef.current;
    const span = textRef.current;
    if (!el || !span) return;

    const containerW = el.offsetWidth;
    const textW = span.scrollWidth;
    const overflow = Math.max(0, textW - containerW);

    if (overflow > 0) {
      setNeedsScroll(true);

      // Scroll distance includes a small extra so the fade looks good near the right edge
      const fadeRight = 24;
      const distance = overflow + fadeRight;
      setScrollPx(distance);

      // Duration: scale with distance (clamped)
      const seconds = Math.min(14, Math.max(6, distance / 40));
      setAnimDuration(`${seconds}s`);

      // Mask fade on edges
      const fadeLeft = 10;
      setMaskCSS(
        `linear-gradient(to right,
          rgba(0,0,0,0.08) 0px,
          rgba(0,0,0,1) ${fadeLeft}px,
          rgba(0,0,0,1) calc(100% - ${fadeRight}px),
          rgba(0,0,0,0) 100%)`
      );

      // Restart the animation whenever size/text changes
      setAnimKey((k) => k + 1);
    } else {
      setNeedsScroll(false);
      setScrollPx(0);
      setAnimDuration("0s");
      // keep a very subtle edge fade
      setMaskCSS(
        `linear-gradient(to right,
          rgba(0,0,0,0.04) 0px,
          rgba(0,0,0,1) 8px,
          rgba(0,0,0,1) calc(100% - 8px),
          rgba(0,0,0,0.04) 100%)`
      );
    }
  }, []);

  useEffect(() => {
    computeOverflow();
    const ro = new ResizeObserver(computeOverflow);
    if (containerRef.current) ro.observe(containerRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [computeOverflow, topKnowby]);


  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);
    const isMonthly = chartType === "monthly";
    const baseY = Array.isArray(base.yaxis) ? base.yaxis[0] : base.yaxis;

    return {
      ...base,
      xaxis: {
        ...(base.xaxis ?? {}),
        labels: {
          ...(base.xaxis?.labels ?? {}),
          format: chartType === "daily" ? "dd MMM" : "MMM yy",
        },
      },
      yaxis: {
        ...(baseY ?? {}),
        ...(isMonthly ? { min: 0, max: 100, tickAmount: 5 } : {}),
        labels: {
          ...((baseY as any)?.labels ?? {}),
          formatter: (v: number) =>
            isMonthly ? `${Math.round(v)}%` : `${Math.round(v)}`,
        },
      },
      tooltip: {
        ...(base.tooltip ?? {}),
        x: { format: chartType === "daily" ? "dd MMM" : "MMM yy", },
        theme: isDark ? "dark" : "light",
      },
    };
  }, [isDark, chartType]);

  // Only show skeleton on very first load; keep chart during "refreshing"
  if (status === "loading") {
    return (
      <Card className="flex flex-col p-6 rounded-xl gap-3">
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

  // ================================================

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        {/* Header */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-lg text-white bg-gradient-to-b from-blue-500 to-blue-700">
            <TrendingUp className="h-8 w-8" />
          </div>

          {/* Text column */}
          <div className="flex flex-col gap-1 w-full min-w-0"> {/* <-- min-w-0 added */}
            {/* Title row + selector */}
            <div className="flex items-start">
              <h3 className="text-lg font-semibold shrink-0">Top Knowby</h3> {/* <-- prevent shrinking */}
              <div className="ml-auto flex gap-1 flex-shrink-0">           {/* <-- don't let buttons shrink */}
                <Tabs
                  value={chartType}
                  onValueChange={(v) => v && setChartType(v as "daily" | "monthly")}
                  className="ml-auto shrink-0"
                >
                  <TabsList className="bg-muted p-0.5 rounded-md h-7">
                    <TabsTrigger
                      value="daily"
                      className="h-6 px-2 text-xs rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      10d
                    </TabsTrigger>
                    <TabsTrigger
                      value="monthly"
                      className="h-6 px-2 text-xs rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      12m
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Scrolling blue title */}
            <div
              ref={containerRef}
              className="min-w-0 overflow-hidden font-bold whitespace-nowrap text-blue-600 dark:text-blue-400 leading-tight"
              style={{
                maskImage: maskCSS,
                WebkitMaskImage: maskCSS,
                paddingLeft: "5px",
                paddingRight: "5px",
              }}
              title={topKnowby}
            >
              <span
                key={animKey}
                ref={textRef}
                className={`${needsScroll ? "inline-block marquee--leftfade" : "inline-block"} text-2xl md:text-3xl`}
                style={
                  needsScroll
                    ? ({
                      ["--scroll-distance" as any]: `-${scrollPx}px`,  // note the minus for left
                      ["--marquee-duration" as any]: animDuration,
                    } as React.CSSProperties)
                    : undefined
                }
              >
                {topKnowby}
              </span>

            </div>

            {/* Big percentage */}
            {/* <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">
                {stats.rate !== null ? `${Math.round(stats.rate)}%` : "--%"}
              </div>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </div> */}
          </div>
        </div>

        <hr className="border-border" />

        {/* Chart */}
        <CardContent className="p-0 overflow-hidden">
          <div className="h-[145px] overflow-hidden">
            <Chart options={options} series={series} type="area" height={150} />
          </div>
        </CardContent>

        {/* Caption + Footer */}
        <div className="pl-6 pr-6">
          <div className="flex justify-center">
            <p className="text-xs font-semibold">
              {chartType === "daily"
                ? `Daily Views & Completions for ${topKnowby} (last 10 days)`
                : `Monthly Completion Rate for ${topKnowby} (last 12 months)`}
            </p>
          </div>

          <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{chartType === "daily" ? totalsDaily.views : totalsMonthly.views}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Views ({chartType === "daily" ? "10 days" : "12 months"})</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>{chartType === "daily" ? totalsDaily.comps : totalsMonthly.comps}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Completions ({chartType === "daily" ? "10 days" : "12 months"})</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    {stats.rate !== null ? `${stats.rate.toFixed(2)}%` : "--%"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion Rate ({chartType === "daily" ? "10 days" : "12 months"})</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>

      {/* Local CSS for marquee */}
      <style jsx>{`
        /* Moves left, fades out, snaps back invisible, fades in */
        .marquee--leftfade {
          animation: marqueeLeftFade var(--marquee-duration, 8s) linear infinite;
        }

        @keyframes marqueeLeftFade {
          0%   { transform: translateX(0);                          opacity: 1; }
          75%  { transform: translateX(var(--scroll-distance, -120px)); opacity: 1; }
          85%  { transform: translateX(var(--scroll-distance, -120px)); opacity: 0; } /* fade out */
          86%  { transform: translateX(0);                          opacity: 0; }     /* snap back invisible */
          100% { transform: translateX(0);                          opacity: 1; }     /* fade in */
        }


      `}</style>
    </TooltipProvider>
  );
}
