// components/Cards/AnalyticsExplorer.tsx
"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DateRange } from "react-day-picker";
import {
  parse as parseDateFn,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  isWithinInterval, differenceInCalendarDays, format
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { useDarkMode } from "@/components/NivoWrapper";
import { topChartOptions } from "@/lib/chartOptions";
import type { ApexOptions } from "apexcharts";
import {
  Eye, CheckCircle, TrendingUp,
  BarChart3, LineChart,
  ArrowUpRight, ArrowDownRight, Search,
  InfoIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ---------------- Types ----------------
type Props = { selectedDateRange: DateRange | undefined };
type Metric = "views" | "completions" | "completionRate" | "both";
type ChartType = "area" | "bar";
type UsageRow = { name: string; views: number; completions: number };

// ---------------- Helpers ----------------
const parseCache = new Map<string, Date>();
const parseCsvDate = (d?: string) => {
  if (!d) return null;
  const hit = parseCache.get(d); if (hit) return hit;
  const dt = parseDateFn(d, "dd/MM/yyyy", new Date());
  if (!isNaN(dt.getTime())) parseCache.set(d, dt);
  return isNaN(dt.getTime()) ? null : dt;
};

const pill = (
  active: boolean,
  tone: "views" | "completions" | "both" | "neutral" = "neutral"
) =>
  `inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs ring-1 transition whitespace-nowrap ${({
    views:
      "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-white/10",
    completions:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-white/10",
    both:
      "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-white/10",
    neutral:
      "bg-muted/60 text-foreground/80 ring-black/5 dark:ring-white/10",
  } as const)[tone]
  } ${active ? "font-semibold" : "opacity-60 hover:opacity-100"}`;

// ---------------- Main Component ----------------
export default function AnalyticsExplorer({ selectedDateRange }: Props) {
  const { views, completions, status } = useKnowbyData();
  const isDark = useDarkMode();

  const [metric, setMetric] = useState<Metric>("views");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [selKnowbys, setSelKnowbys] = useState<string[]>([]);
  const [selEmployees, setSelEmployees] = useState<string[]>([]);
  const [usageView, setUsageView] = useState<"knowbys" | "employees">("knowbys");
  const [usageQuery, setUsageQuery] = useState("");

  const selectedNames = usageView === "knowbys" ? selKnowbys : selEmployees;
  const hasUsageSelection = selectedNames.length > 0;

  const toggleSelection = (type: "knowbys" | "employees", name: string) => {
    if (type === "knowbys") {
      setSelKnowbys((prev) =>
        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      );
    } else {
      setSelEmployees((prev) =>
        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      );
    }
  };

  const clearUsageSelection = (type: "knowbys" | "employees") => {
    if (type === "knowbys") setSelKnowbys([]);
    else setSelEmployees([]);
  };

  // ------- Derivations (unchanged logic) -------
  const computed = useMemo(() => {
    const allViews = views ?? [];
    const allComps = completions ?? [];
    const allRecords = [...allViews, ...allComps];
    const allKnowbys = Array.from(new Set<string>(allRecords.map(r => r?.knowby_name).filter((v): v is string => Boolean(v)))).sort();
    const allEmployees = Array.from(new Set<string>(allRecords.map(r => r?.member_name).filter((v): v is string => Boolean(v)))).sort();

    const dMin = allRecords.reduce<Date | null>((acc, r: any) => {
      const d = parseCsvDate(r?.date); return !acc || (d && d < acc) ? d : acc;
    }, null) ?? new Date();

    const dateStart = selectedDateRange?.from ?? dMin;
    const dateEnd = selectedDateRange?.to ?? new Date();
    const inRange = (d: Date | null) => !!d && isWithinInterval(d, { start: startOfDay(dateStart), end: endOfDay(dateEnd) });

    const viewsInRange = allViews.filter(r => inRange(parseCsvDate(r?.date)));
    const compsInRange = allComps.filter(r => inRange(parseCsvDate(r?.date)));

    const filterBySelection = (rows: any[]) => rows.filter(r => {
      const kOK = selKnowbys.length === 0 || selKnowbys.includes(r?.knowby_name);
      const eOK = selEmployees.length === 0 || selEmployees.includes(r?.member_name);
      return kOK && eOK;
    });

    const viewsF = filterBySelection(viewsInRange);
    const compsF = filterBySelection(compsInRange);

    const sameMonth =
      dateStart.getFullYear() === dateEnd.getFullYear() &&
      dateStart.getMonth() === dateEnd.getMonth();

    const coversMonth =
      startOfMonth(dateStart).getTime() === startOfDay(dateStart).getTime() &&
      endOfMonth(dateEnd).getTime() === endOfDay(dateEnd).getTime();

    const spanDays = Math.max(1, differenceInCalendarDays(endOfDay(dateEnd), startOfDay(dateStart)));
    const gran: "day" | "week" | "month" =
      (sameMonth && coversMonth) ? "day"
        : (spanDays <= 14 ? "day" : spanDays <= 120 ? "week" : "month");

    type Bin = { start: Date; end: Date; ts: number };
    const bins: Bin[] =
      gran === "day"
        ? eachDayOfInterval({ start: dateStart, end: dateEnd }).map(d => {
          const s = startOfDay(d), e = endOfDay(d);
          return { start: s, end: e, ts: s.getTime() };
        })
        : gran === "week"
          ? eachWeekOfInterval({ start: dateStart, end: dateEnd }, { weekStartsOn: 1 })
            .map(ws => {
              const s = startOfDay(ws), e = endOfWeek(ws, { weekStartsOn: 1 });
              return { start: s, end: e, ts: s.getTime() };
            })
          : eachMonthOfInterval({ start: dateStart, end: dateEnd })
            .map(ms => {
              const s = startOfMonth(ms), e = endOfMonth(ms);
              return { start: s, end: e, ts: s.getTime() };
            });

    const names = (selKnowbys.length > 0 ? selKnowbys : ["All Knowbys"]);
    const makeCount = (rows: any[], name: string, b: Bin) =>
      rows.filter((r: any) => {
        const d = parseCsvDate(r?.date);
        const ok = name === "All Knowbys" || r?.knowby_name === name;
        return ok && d && isWithinInterval(d, { start: b.start, end: b.end });
      }).length;

    const keys = names.flatMap(n =>
      metric === "both" ? [`${n} Views`, `${n} Completions`]
        : metric === "views" ? [`${n} Views`]
          : metric === "completions" ? [`${n} Completions`]
            : [`${n} Completion Rate`]
    );

    const seriesPoints = new Map<string, Array<[number, number]>>();
    for (const b of bins) {
      for (const n of names) {
        const v = makeCount(viewsF, n, b), c = makeCount(compsF, n, b);
        if (metric === "views") {
          const key = `${n} Views`;
          (seriesPoints.get(key) ?? seriesPoints.set(key, []).get(key)!).push([b.ts, v]);
        } else if (metric === "completions") {
          const key = `${n} Completions`;
          (seriesPoints.get(key) ?? seriesPoints.set(key, []).get(key)!).push([b.ts, c]);
        } else if (metric === "both") {
          const keyV = `${n} Views`;
          const keyC = `${n} Completions`;
          (seriesPoints.get(keyV) ?? seriesPoints.set(keyV, []).get(keyV)!).push([b.ts, v]);
          (seriesPoints.get(keyC) ?? seriesPoints.set(keyC, []).get(keyC)!).push([b.ts, c]);
        } else {
          const key = `${n} Completion Rate`;
          const rate = v > 0 ? Math.round((c / v) * 100) : 0;
          (seriesPoints.get(key) ?? seriesPoints.set(key, []).get(key)!).push([b.ts, rate]);
        }
      }
    }

    const tsSeries = Array.from(seriesPoints.entries()).map(([name, data]) => ({ name, data }));

    const totals = { views: viewsF.length, comps: compsF.length };
    const avgRate = totals.views > 0 ? Math.round((totals.comps / totals.views) * 100) : 0;

    let trend: "up" | "down" | "neutral" = "neutral";
    const firstKey = keys[0];
    if (firstKey) {
      const s = tsSeries.find(s => s.name === firstKey)?.data ?? [];
      if (s.length >= 2) {
        const last = s[s.length - 1][1];
        const prev = s[s.length - 2][1];
        trend = last > prev ? "up" : last < prev ? "down" : "neutral";
      }
    }

    const initUsageMap = (names: string[]): Map<string, UsageRow> => {
      const map = new Map<string, UsageRow>();
      names.forEach(name => map.set(name, { name, views: 0, completions: 0 }));
      return map;
    };
    const sortUsage = (rows: UsageRow[]) =>
      rows.sort((a, b) => {
        const totalA = a.views + a.completions;
        const totalB = b.views + b.completions;
        if (totalA === totalB) return a.name.localeCompare(b.name);
        return totalB - totalA;
      });

    const knowbyUsageMap = initUsageMap(allKnowbys);
    for (const row of viewsInRange) {
      const name = row?.knowby_name;
      if (name && knowbyUsageMap.has(name)) knowbyUsageMap.get(name)!.views += 1;
    }
    for (const row of compsInRange) {
      const name = row?.knowby_name;
      if (name && knowbyUsageMap.has(name)) knowbyUsageMap.get(name)!.completions += 1;
    }
    const usageByKnowby = sortUsage(Array.from(knowbyUsageMap.values()));

    const employeeUsageMap = initUsageMap(allEmployees);
    for (const row of viewsInRange) {
      const name = row?.member_name;
      if (name && employeeUsageMap.has(name)) employeeUsageMap.get(name)!.views += 1;
    }
    for (const row of compsInRange) {
      const name = row?.member_name;
      if (name && employeeUsageMap.has(name)) employeeUsageMap.get(name)!.completions += 1;
    }
    const usageByEmployee = sortUsage(Array.from(employeeUsageMap.values()));

    return {
      dateStart, dateEnd, gran: gran as "day" | "week" | "month",
      bins, tsSeries, keys,
      allKnowbys, allEmployees, avgRate,
      totals, trend,
      usageByKnowby,
      usageByEmployee,
    };
  }, [views, completions, selectedDateRange, selKnowbys, selEmployees, metric]);

  const series = computed.tsSeries;

  const usageResults = useMemo(() => {
    const query = usageQuery.trim().toLowerCase();
    const source = usageView === "knowbys" ? computed.usageByKnowby : computed.usageByEmployee;
    const filtered = query
      ? source.filter(item => item.name.toLowerCase().includes(query))
      : source;

    const active = filtered.filter(item => item.views + item.completions > 0);
    const inactive = filtered.filter(item => item.views + item.completions === 0);
    const totals = filtered.reduce(
      (acc, item) => {
        acc.views += item.views;
        acc.completions += item.completions;
        return acc;
      },
      { views: 0, completions: 0 }
    );

    return { active, inactive, total: filtered.length, totals };
  }, [usageQuery, usageView, computed.usageByKnowby, computed.usageByEmployee]);

  const usageHeadline = usageView === "knowbys" ? "Knowbys" : "Employees";
  const activeCount = usageResults.active.length;
  const inactiveCount = usageResults.inactive.length;
  const activeShare = usageResults.total > 0
    ? Math.round((activeCount / usageResults.total) * 100)
    : 0;

  // --- Chart options (kept) + refined paddings/labels ---
  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);
    const xLabelFormat =
      computed.gran === "month" ? "MMM yyyy"
        : computed.gran === "week" ? "dd MMM"
          : "dd MMM";

    let colors: string[] = [];
    if (metric === "views") colors = ["#008FFB"];
    else if (metric === "completions") colors = ["#00E396"];
    else if (metric === "both") colors = ["#38bdf8", "#10b981"];
    else if (metric === "completionRate") colors = ["#8b5cf6"];

    return {
      ...base,
      colors,
      chart: {
        ...(base.chart ?? {}),
        type: chartType,
        toolbar: { show: false },
        redrawOnParentResize: true,
        redrawOnWindowResize: false,
      },
      dataLabels: { enabled: false },
      xaxis: {
        ...(base.xaxis ?? {}),
        type: "datetime",
        labels: { ...(base.xaxis?.labels ?? {}), rotate: -15, format: xLabelFormat },
      },
      yaxis: {
        ...(base.yaxis ?? {}),
        min: 0,
        max: metric === "completionRate" ? 100 : undefined,
        labels: {
          ...(Array.isArray(base.yaxis) ? {} : base.yaxis?.labels ?? {}),
          formatter: (v: number) =>
            metric === "completionRate" ? `${v}%` : `${v}`,
        },
      },
      grid: {
        ...(base.grid ?? {}),
        padding: { ...base.grid?.padding, right: 6, left: 6 },
      },
      tooltip: {
        ...(base.tooltip ?? {}),
        shared: true,
        theme: isDark ? "dark" : "light",
        x: {
          formatter: (ts: number) => {
            if (computed.gran === "day") return format(new Date(ts), "dd MMM yyyy");
            if (computed.gran === "week") {
              const b = computed.bins.find(b => b.ts === ts);
              return b
                ? `${format(b.start, "dd MMM")} – ${format(b.end, "dd MMM yyyy")}`
                : format(new Date(ts), "dd MMM yyyy");
            }
            return format(new Date(ts), "MMM yyyy");
          },
        },
        y: {
          formatter: (v: number) =>
            metric === "completionRate" ? `${v}%` : String(v),
        },
      },
    };
  }, [isDark, chartType, computed.gran, computed.bins, metric]);

  // ---------------- UI ----------------
  if (status === "loading") {
    return (
      <Card className="rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card min-h-[340px]" />
    );
  }

  const subtitle =
    `${format((computed as any).dateStart, "d MMM yyyy")} – ${format((computed as any).dateEnd, "d MMM yyyy")}`;

  return (
    <TooltipProvider>
      <Card className="p-5 md:p-6 xl:p-7 rounded-3xl border-0 gap-2 shadow-xl/2 bg-card dark:border dark:border-slate-700">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-full text-white bg-gradient-to-b from-lime-500 to-lime-700">
              <Search className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-semibold dark:text-white leading-tight">
                Analytics Explorer
              </h3>
              <span className="block text-[11px] md:text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </span>
            </div>
          </div>

          <span className="hidden sm:inline-flex text-[11px] text-muted-foreground items-center gap-1">
            <InfoIcon className="h-4 w-4 opacity-60" />
            Metrics shown for chosen time period
          </span>
        </div>

        <CardContent className="p-0">
          <div className="flex flex-col gap-5 md:gap-6">
            <section className="rounded-2xl ring-1 ring-black/5 dark:ring-white/10 p-5 md:p-6 bg-white/70 dark:bg-black/10">
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-8">
                {/* LEFT PANEL */}
                <div className="flex flex-col gap-5">
                  {/* Switch — Knowbys (blue) / Employees (green) */}
                  <Tabs
                    value={usageView}
                    onValueChange={(v) => setUsageView(v as "knowbys" | "employees")}
                    className="lg:w-auto lg:min-w-[240px]"
                  >
                    <TabsList
                      className={cn(
                        "w-full justify-between rounded-2xl p-1",
                        "border border-slate-200/70 bg-white/80 shadow-sm",
                        "dark:border-slate-800 dark:bg-slate-900/70"
                      )}
                    >
                      <TabsTrigger
                        value="knowbys"
                        className={cn(
                          "flex-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                          "text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
                          "data-[state=active]:shadow",
                          // >> force active color
                          "[&[data-state=active]]:bg-sky-500 [&[data-state=active]]:text-white",
                          "dark:[&[data-state=active]]:bg-sky-600"
                        )}
                      >
                        Knowbys
                      </TabsTrigger>

                      <TabsTrigger
                        value="employees"
                        className={cn(
                          "flex-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                          "text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
                          "data-[state=active]:shadow",
                          // >> force active color
                          "[&[data-state=active]]:bg-emerald-500 [&[data-state=active]]:text-white",
                          "dark:[&[data-state=active]]:bg-emerald-600"
                        )}
                      >
                        Employees
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>


                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usage Directory</p>
                    <h3 className="text-[15px] md:text-base font-semibold leading-tight">Find active and inactive {usageHeadline.toLowerCase()}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                        Active {activeShare}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/40">
                        {usageResults.total} total
                      </span>
                    </div>
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-fuchsia-200/50 bg-fuchsia-50 px-3 py-3 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-200">Active</p>
                      <p className="text-2xl font-semibold text-fuchsia-700 dark:text-fuchsia-100">{activeCount}</p>
                      <p className="text-[10px] text-fuchsia-700/70 dark:text-fuchsia-100/70">{activeShare}% of filtered list</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200/50 bg-rose-50 px-3 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200">Inactive</p>
                      <p className="text-2xl font-semibold text-rose-700 dark:text-rose-100">{inactiveCount}</p>
                      <p className="text-[10px] text-rose-700/70 dark:text-rose-100/70">Need attention</p>
                    </div>
                    <div className="rounded-2xl border border-blue-200/50 bg-blue-50 px-3 py-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">Views</p>
                      <p className="text-2xl font-semibold text-blue-700 dark:text-blue-100">{usageResults.totals.views}</p>
                      <p className="text-[10px] text-blue-700/70 dark:text-blue-100/70">Recorded in range</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50 px-3 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Completions</p>
                      <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-100">{usageResults.totals.completions}</p>
                      <p className="text-[10px] text-emerald-700/70 dark:text-emerald-100/70">Recorded in range</p>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left group */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="secondary" className="rounded-full bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-slate-100 shadow dark:bg-slate-800">{usageHeadline}
                      </Badge>

                      {/* totals/info group */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{usageResults.total} result{usageResults.total === 1 ? "" : "s"}</span>
                        <span>Showing {format(computed.dateStart, "d MMM")} –{" "}{format(computed.dateEnd, "d MMM yyyy")}</span>
                      </div>
                    </div>

                    {/* Search input stays right-aligned */}
                    <Input
                      value={usageQuery}
                      onChange={(e) => setUsageQuery(e.target.value)}
                      placeholder={`Search ${usageHeadline}…`}
                      className="h-9 w-full sm:w-auto sm:min-w-[240px] border-slate-200 bg-white/85 text-sm shadow-sm transition focus-visible:ring-sky-500/40 dark:border-slate-800 dark:bg-slate-900/70"
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Active list */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">Recent activity</p>
                        <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
                          {activeCount}
                        </span>
                      </div>
                      <div className="mt-2 space-y-2 max-h-[275px] overflow-y-auto pr-1">
                        {usageResults.active.length ? (
                          <ul className="space-y-2">
                            {usageResults.active.map((item) => {
                              const isSelected = selectedNames.includes(item.name);
                              return (
                                <li key={item.name}>
                                  <button
                                    type="button"
                                    onClick={() => toggleSelection(usageView, item.name)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                      "w-full flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition cursor-pointer",
                                      "border-slate-200/60 bg-white/80 hover:border-emerald-400/60 hover:bg-emerald-50/80 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-500/10",
                                      isSelected && "border-emerald-500/70 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.25)] dark:bg-emerald-500/15"
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <p className={cn("text-sm font-medium truncate", isSelected && "text-emerald-700 dark:text-emerald-200")}>{item.name}</p>
                                      <p className="text-xs text-muted-foreground flex items-center gap-3">
                                        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {item.views}</span>
                                        <span className="inline-flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {item.completions}</span>
                                      </p>
                                    </div>
                                    <span className={cn(
                                      "inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      "bg-emerald-100 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-100",
                                      isSelected && "bg-emerald-500 text-white dark:bg-emerald-400/80"
                                    )}>
                                      {isSelected ? "Selected" : "Active"}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground/80">No recent activity found.</p>
                        )}
                      </div>
                    </div>

                    {/* Inactive list */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">No recent usage</p>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/40">
                          {inactiveCount}
                        </span>
                      </div>
                      <div className="mt-2 space-y-2 max-h-[275px] overflow-y-auto pr-1">
                        {usageResults.inactive.length ? (
                          <ul className="space-y-2">
                            {usageResults.inactive.map((item) => {
                              const isSelected = selectedNames.includes(item.name);
                              return (
                                <li key={item.name}>
                                  <button
                                    type="button"
                                    onClick={() => toggleSelection(usageView, item.name)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                      "w-full flex items-center justify-between gap-3 rounded-2xl border border-dashed px-3 py-2 text-left transition cursor-pointer",
                                      "border-slate-200/60 bg-white/70 hover:border-violet-400/50 hover:bg-violet-50/80 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10",
                                      isSelected && "border-violet-500/60 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.25)] dark:bg-violet-500/15"
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <p className={cn("text-sm font-medium truncate", isSelected && "text-violet-700 dark:text-violet-200")}>{item.name}</p>
                                      <p className="text-xs text-muted-foreground">No views or completions in this range.</p>
                                    </div>
                                    <span className={cn(
                                      "inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      "bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
                                      isSelected && "border-violet-500 bg-violet-500 text-white"
                                    )}>
                                      {isSelected ? "Selected" : "Inactive"}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground/80">Everyone here has activity 🎉</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selections footer */}
                  <div className="flex flex-col gap-2 pt-2 text-[11px] text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Knowbys</span>
                      {selKnowbys.length === 0 && <span className="text-[11px] text-muted-foreground/60">None selected</span>}
                      {selKnowbys.map((name) => (
                        <Badge key={`knowby-${name}`} variant="outline" className="rounded-full border-sky-300/60 bg-sky-50/70 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/10 dark:text-sky-100">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Employees</span>
                      {selEmployees.length === 0 && <span className="text-[11px] text-muted-foreground/60">None selected</span>}
                      {selEmployees.map((name) => (
                        <Badge key={`employee-${name}`} variant="outline" className="rounded-full border-emerald-300/60 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-100">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    {hasUsageSelection && (
                      <button
                        type="button"
                        onClick={() => clearUsageSelection(usageView)}
                        className="self-start text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      >
                        Clear {usageHeadline.toLowerCase()} filter
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button className={cn(pill(metric === "views", "views"), "cursor-pointer")} onClick={() => setMetric("views")}>
                    <Eye className="h-4 w-4" /> Views
                  </button>
                  <button className={cn(pill(metric === "completions", "completions"), "cursor-pointer")} onClick={() => setMetric("completions")}>
                    <CheckCircle className="h-4 w-4" /> Completions
                  </button>
                  <button className={cn(pill(metric === "both", "both"), "cursor-pointer")} onClick={() => setMetric("both")}>
                    <Eye className="h-4 w-4" /> + <CheckCircle className="h-4 w-4" />
                  </button>
                  <button className={cn(pill(metric === "completionRate", "neutral"), "cursor-pointer")} onClick={() => setMetric("completionRate")}>
                    <TrendingUp className="h-4 w-4" /> Rate
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className={cn(pill(chartType === "area"), "cursor-pointer")} onClick={() => setChartType("area")}>
                    <LineChart className="h-4 w-4" /> Area
                  </button>
                  <button className={cn(pill(chartType === "bar"), "cursor-pointer")} onClick={() => setChartType("bar")}>
                    <BarChart3 className="h-4 w-4" /> Bar
                  </button>
                </div>
              </div>

              {/* Chart block */}
              <div className="mt-6 rounded-3xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usage over time</h4>
                  <span className="text-[11px] text-muted-foreground">{metric}</span>
                </div>
                <div className="mt-3 h-[260px] sm:h-[300px] md:h-[320px] lg:h-[340px]">
                  {computed.keys.length === 0 ? (
                    <div className="h-full grid place-items-center rounded-2xl border border-dashed border-slate-200/70 bg-white/70 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/60">
                      Select a Knowby or keep “All Knowbys” and choose a metric.
                    </div>
                  ) : (
                    <Chart type={chartType} height="100%" options={options} series={series as any} />
                  )}
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
