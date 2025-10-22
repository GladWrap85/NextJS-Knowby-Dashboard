"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DateRange } from "react-day-picker";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parse as parseDateFn,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Eye, CheckCircle, TrendingUp, BarChart3, LineChart, Search, InfoIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { useDarkMode } from "@/components/NivoWrapper";
import { topChartOptions } from "@/lib/chartOptions";
import type { ApexOptions } from "apexcharts";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ---------- types ----------
type Props = { selectedDateRange: DateRange | undefined };
type Metric = "views" | "completions" | "completionRate" | "both";
type ChartType = "area" | "bar";
type RawRow = {
  date?: string | null;
  knowby_name?: string | null;
  member_name?: string | null;
};
type UsageRow = { name: string; views: number; completions: number };
type SelectionEventRow = {
  knowbyName: string;
  employeeName: string;
  type: "view" | "completion";
  date: Date;
};


type Bin = { start: Date; end: Date; ts: number };

type AnalyticsModel = {
  dateStart: Date;
  dateEnd: Date;
  gran: "day" | "week" | "month";
  bins: Bin[];
  keys: string[];
  series: { name: string; data: Array<[number, number]> }[];
  totals: { views: number; comps: number };
  avgRate: number;
  trend: "up" | "down" | "neutral";
  usage: { knowbys: UsageRow[]; employees: UsageRow[] };
  viewsInRange: RawRow[];
  compsInRange: RawRow[];
  allKnowbys: string[];
  allEmployees: string[];
};

const ACTIVITY_PAGE_SIZE = 10;
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
      "bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:ring-white/10",
    neutral:
      "bg-muted/60 text-foreground/80 ring-black/5 dark:ring-white/10",
  } as const)[tone]}
  ${active ? "font-semibold" : "opacity-60 hover:opacity-100"}`;

// ---------- helpers ----------
const parseCache = new Map<string, Date>();
const parseCsvDate = (input?: string | null) => {
  if (!input) return null;
  if (parseCache.has(input)) return parseCache.get(input)!;
  const dt = parseDateFn(input, "dd/MM/yyyy", new Date());
  if (!isNaN(dt.getTime())) parseCache.set(input, dt);
  return isNaN(dt.getTime()) ? null : dt;
};

const uniqueSorted = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );

const makeUsage = (
  names: string[],
  views: RawRow[],
  comps: RawRow[],
  field: "knowby_name" | "member_name"
) => {
  const map = new Map<string, UsageRow>();
  names.forEach((name) => map.set(name, { name, views: 0, completions: 0 }));
  const hit = (row: RawRow | undefined, key: "views" | "completions") => {
    if (!row) return;
    const name = row[field];
    if (!name || !map.has(name)) return;
    map.get(name)![key === "views" ? "views" : "completions"] += 1;
  };
  views.forEach((r) => hit(r, "views"));
  comps.forEach((r) => hit(r, "completions"));
  return [...map.values()].sort((a, b) => {
    const totalA = a.views + a.completions;
    const totalB = b.views + b.completions;
    return totalB === totalA ? a.name.localeCompare(b.name) : totalB - totalA;
  });
};

const countActiveInactive = (items: UsageRow[]) => {
  const total = items.length;
  const active = items.filter(i => i.views + i.completions > 0).length;
  const inactive = total - active;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return { total, active, inactive, pctActive: pct(active), pctInactive: pct(inactive) };
};

const resolveGranularity = (start: Date, end: Date) => {
  const span = Math.max(1, differenceInCalendarDays(endOfDay(end), startOfDay(start)));
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const coversWholeMonth =
    startOfMonth(start).getTime() === startOfDay(start).getTime() &&
    endOfMonth(end).getTime() === endOfDay(end).getTime();
  if (sameMonth && coversWholeMonth) return "day" as const;
  if (span <= 14) return "day" as const;
  if (span <= 120) return "week" as const;
  return "month" as const;
};

const buildBins = (gran: "day" | "week" | "month", start: Date, end: Date): Bin[] => {
  const base =
    gran === "day"
      ? eachDayOfInterval({ start, end })
      : gran === "week"
        ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
        : eachMonthOfInterval({ start, end });
  return base.map((point) => {
    if (gran === "day") {
      const s = startOfDay(point), e = endOfDay(point);
      return { start: s, end: e, ts: s.getTime() };
    }
    if (gran === "week") {
      const s = startOfWeek(point, { weekStartsOn: 1 }), e = endOfWeek(point, { weekStartsOn: 1 });
      return { start: startOfDay(s), end: endOfDay(e), ts: startOfDay(s).getTime() };
    }
    const s = startOfMonth(point), e = endOfMonth(point);
    return { start: startOfDay(s), end: endOfDay(e), ts: startOfDay(s).getTime() };
  });
};

const buildSeries = (
  bins: Bin[],
  metric: Metric,
  names: string[],
  views: RawRow[],
  comps: RawRow[]
) => {
  const series = new Map<string, Array<[number, number]>>();
  const count = (rows: RawRow[], name: string, bin: Bin) =>
    rows.filter((r) => {
      const d = parseCsvDate(r.date);
      if (!d) return false;
      const matchesName = name === "All Knowbys" || r.knowby_name === name;
      return matchesName && isWithinInterval(d, { start: bin.start, end: bin.end });
    }).length;

  bins.forEach((bin) => {
    names.forEach((name) => {
      const viewsCount = count(views, name, bin);
      const compsCount = count(comps, name, bin);
      const push = (key: string, value: number) => {
        if (!series.has(key)) series.set(key, []);
        series.get(key)!.push([bin.ts, value]);
      };
      if (metric === "views") push(`${name} Views`, viewsCount);
      else if (metric === "completions") push(`${name} Completions`, compsCount);
      else if (metric === "both") {
        push(`${name} Views`, viewsCount);
        push(`${name} Completions`, compsCount);
      } else {
        push(`${name} Completion Rate`, viewsCount > 0 ? Math.round((compsCount / viewsCount) * 100) : 0);
      }
    });
  });

  const keys = names.flatMap((name) =>
    metric === "both"
      ? [`${name} Views`, `${name} Completions`]
      : metric === "views"
        ? [`${name} Views`]
        : metric === "completions"
          ? [`${name} Completions`]
          : [`${name} Completion Rate`]
  );
  const tsSeries = [...series.entries()].map(([name, data]) => ({ name, data }));

  const totals = {
    views: views.length,
    comps: comps.length,
  };
  const avgRate = totals.views ? Math.round((totals.comps / totals.views) * 100) : 0;

  let trend: "up" | "down" | "neutral" = "neutral";
  const firstKey = keys[0];
  if (firstKey) {
    const points = tsSeries.find((s) => s.name === firstKey)?.data ?? [];
    if (points.length >= 2) {
      const [prev, last] = [points.at(-2)?.[1] ?? 0, points.at(-1)?.[1] ?? 0];
      trend = last > prev ? "up" : last < prev ? "down" : "neutral";
    }
  }

  return { keys, tsSeries, totals, avgRate, trend };
};

const buildAnalytics = (
  views: RawRow[] = [],
  completions: RawRow[] = [],
  selectedDateRange: DateRange | undefined,
  selKnowbys: string[],
  selEmployees: string[],
  metric: Metric
): AnalyticsModel => {
  const allRows = [...views, ...completions];
  const allKnowbys = uniqueSorted(allRows.map((r) => r.knowby_name));
  const allEmployees = uniqueSorted(allRows.map((r) => r.member_name));
  const defaultDate = new Date();
  const earliest = allRows.reduce<Date | null>((acc, row) => {
    const d = parseCsvDate(row.date);
    if (!d) return acc;
    return !acc || d < acc ? d : acc;
  }, null);

  const start = startOfDay(selectedDateRange?.from ?? earliest ?? defaultDate);
  const end = endOfDay(selectedDateRange?.to ?? selectedDateRange?.from ?? earliest ?? defaultDate);

  const inRange = (row: RawRow) => {
    const d = parseCsvDate(row.date);
    if (!d) return false;
    return isWithinInterval(d, { start, end });
  };

  const matchesSelection = (row: RawRow) => {
    const knowbyOK = !selKnowbys.length || (row.knowby_name && selKnowbys.includes(row.knowby_name));
    const employeeOK = !selEmployees.length || (row.member_name && selEmployees.includes(row.member_name));
    return knowbyOK && employeeOK;
  };

  const viewsInRange = views.filter((row) => inRange(row));
  const compsInRange = completions.filter((row) => inRange(row));
  const filteredViews = viewsInRange.filter(matchesSelection);
  const filteredComps = compsInRange.filter(matchesSelection);

  const gran = resolveGranularity(start, end);
  const bins = buildBins(gran, start, end);
  const chartNames = selKnowbys.length ? selKnowbys : ["All Knowbys"];
  const { keys, tsSeries, totals, avgRate, trend } = buildSeries(
    bins,
    metric,
    chartNames,
    filteredViews,
    filteredComps
  );

  const usage = {
    knowbys: makeUsage(allKnowbys, viewsInRange, compsInRange, "knowby_name"),
    employees: makeUsage(allEmployees, viewsInRange, compsInRange, "member_name"),
  };

  return {
    dateStart: start,
    dateEnd: end,
    gran,
    bins,
    keys,
    series: tsSeries,
    totals,
    avgRate,
    trend,
    usage,
    viewsInRange,
    compsInRange,
    allKnowbys,
    allEmployees,
  };
};

const buildOptions = (
  isDark: boolean,
  chartType: ChartType,
  gran: "day" | "week" | "month",
  bins: Bin[],
  metric: Metric
): ApexOptions => {
  const base = topChartOptions(isDark);
  const labelFormat = gran === "month" ? "MMM yyyy" : "dd MMM";
  const colors =
    metric === "views"
      ? ["#008FFB"]
      : metric === "completions"
        ? ["#00E396"]
        : metric === "both"
          ? ["#38bdf8", "#10b981"]
          : ["#8b5cf6"];

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
      labels: { ...(base.xaxis?.labels ?? {}), rotate: -15, format: labelFormat },
    },
    yaxis: {
      ...(base.yaxis ?? {}),
      min: 0,
      max: metric === "completionRate" ? 100 : undefined,
      labels: {
        ...(Array.isArray(base.yaxis) ? {} : base.yaxis?.labels ?? {}),
        formatter: (value: number) => (metric === "completionRate" ? `${value}%` : `${value}`),
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
          const date = new Date(ts);
          if (gran === "day") return format(date, "dd MMM yyyy");
          if (gran === "week") {
            const bin = bins.find((b) => b.ts === ts);
            return bin
              ? `${format(bin.start, "dd MMM")} – ${format(bin.end, "dd MMM yyyy")}`
              : format(date, "dd MMM yyyy");
          }
          return format(date, "MMM yyyy");
        },
      },
      y: {
        formatter: (value: number) => (metric === "completionRate" ? `${value}%` : `${value}`),
      },
    },
  };
};

const summaryCards = (
  k: { total: number; active: number; inactive: number; pctActive: number; pctInactive: number },
  e: { total: number; active: number; inactive: number; pctActive: number; pctInactive: number },
) => {
  return [
    {
      title: "Active Knowbys",
      subtitle: `${k.pctActive}% of knowbys`,
      value: k.active,
      className:
        "border-fuchsia-200/60 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
    },
    {
      title: "Inactive Knowbys",
      subtitle: `${k.pctInactive}% of knowbys`,
      value: k.inactive,
      className:
        "border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    },
    {
      title: "Active Employees",
      subtitle: `${e.pctActive}% of employees`,
      value: e.active,
      className:
        "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    },
    {
      title: "Inactive Employees",
      subtitle: `${e.pctInactive}% of employees`,
      value: e.inactive,
      className:
        "border-violet-200/60 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
    },
  ] as const;
};

const metricButtons = (
  metric: Metric,
  setMetric: (metric: Metric) => void,
  chartType: ChartType,
  setChartType: (type: ChartType) => void
) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex flex-wrap items-center gap-2">
      {[
        { key: "views" as const, label: "Views", icon: Eye, tone: "views" as const },
        { key: "completions" as const, label: "Completions", icon: CheckCircle, tone: "completions" as const },
        { key: "both" as const, label: "Views + Completions", icon: Eye, secondary: CheckCircle, tone: "both" as const },
        { key: "completionRate" as const, label: "Rate", icon: TrendingUp, tone: "neutral" as const },
      ].map(({ key, label, icon: Icon, secondary: Secondary, tone }) => (
        <button key={key} onClick={() => setMetric(key)} className={cn(pill(metric === key, tone), "flex items-center gap-1 cursor-pointer px-2 py-1")}>
          {key === "both" ? (
            <>
              <Icon className="h-3.5 w-3.5" />
              <span className="flex items-center gap-1">
                Views + <Secondary className="h-3.5 w-3.5" /> Completions
              </span>
            </>
          ) : (
            <>
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </>
          )}
        </button>
        )
      )}
    </div>
  </div>
);

type UsageListProps = {
  items: UsageRow[];
  selected: string[];
  tone: "emerald" | "violet";
  empty: string;
  badge: string;
  onToggle: (name: string) => void;
};

const UsageList = ({
  items,
  selected,
  tone,
  empty,
  badge,
  onToggle,
}: UsageListProps) => {
  const toneClasses =
    tone === "emerald"
      ? {
        base: "border-slate-200/60 bg-white/80 hover:border-emerald-400/60 hover:bg-emerald-50/70 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-500/10",
        active:
          "border-emerald-500/70 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)] dark:bg-emerald-500/15",
        text: "text-emerald-700 dark:text-emerald-200",
        badge:
          "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-100",
        badgeActive: "bg-emerald-500 text-white dark:bg-emerald-400/80",
      }
      : {
        base: "border-slate-200/60 bg-white/70 hover:border-violet-400/50 hover:bg-violet-50/70 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10",
        active:
          "border-violet-500/60 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.2)] dark:bg-violet-500/15",
        text: "text-violet-700 dark:text-violet-200",
        badge:
          "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        badgeActive: "border-violet-500 bg-violet-500 text-white",
      };

  return (
    <div className="rounded-lg border border-slate-200/60 bg-white/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>{badge}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            tone === "emerald"
              ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
              : "bg-muted text-muted-foreground dark:bg-muted/40"
          )}
        >
          {items.length}
        </span>
      </div>
      <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
        {items.length ? (
          <ul className="space-y-1.5">
            {items.map((item) => {
              const isSelected = selected.includes(item.name);
              return (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => onToggle(item.name)}
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                      toneClasses.base,
                      isSelected && toneClasses.active
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium", isSelected && toneClasses.text)}>
                        {item.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {item.views}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> {item.completions}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        toneClasses.badge,
                        isSelected ? toneClasses.badgeActive : ""
                      )}
                    >
                      {isSelected ? "Selected" : tone === "emerald" ? "Active" : "Inactive"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground/80">{empty}</p>
        )}
      </div>
    </div>
  );
};

type ActivityTableProps = {
  rows: SelectionEventRow[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
};

const ActivityTable = ({ rows, page, setPage, pageSize }: ActivityTableProps) => {
  if (!rows.length) {
    return (
      <p className="text-[11px] text-muted-foreground/80">
        No activity found for the current filters in the chosen range.
      </p>
    );
  }

  const start = page * pageSize;
  const end = Math.min(start + pageSize, rows.length);
  const paged = rows.slice(start, end);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  return (
    <div className="h-full rounded-2xl ring-1 ring-black/10 dark:ring-white/10 pt-0 px-0 bg-white/60 dark:bg-black/10 overflow-hidden">
      <div className="h-1 w-full bg-lime-500"></div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-white/90 dark:bg-black/30 border-b border-slate-200/70 dark:border-white/10">
            <tr className="[&>th]:py-2 [&>th]:px-3 text-left">
              {[
                "Knowby",
                "Employee",
                "Event",
                "When",
              ].map((header) => (
                <th key={header} className="font-bold text-slate-700 dark:text-slate-100">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, idx) => (
              <tr
                key={`${row.type}-${row.date.getTime()}-${row.knowbyName}-${row.employeeName}-${start + idx}`}
                className={cn(
                  "[&>td]:py-1.5 [&>td]:px-3",
                  idx % 2 === 0
                    ? "bg-white/80 dark:bg-slate-800/70"
                    : "bg-slate-50/80 dark:bg-slate-900/50",
                  "hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
                )}
              >
                <td
                  className="whitespace-nowrap max-w-[28ch] truncate text-slate-700 dark:text-slate-200"
                  title={row.knowbyName}
                >
                  {row.knowbyName}
                </td>
                <td
                  className="whitespace-nowrap max-w-[28ch] truncate text-slate-600 dark:text-slate-300"
                  title={row.employeeName}
                >
                  {row.employeeName}
                </td>
                <td className="text-slate-600 dark:text-slate-300">
                  {row.type === "completion" ? "Completed" : "Viewed"}
                </td>
                <td className="text-slate-600 dark:text-slate-300">
                  {format(row.date, "d MMM yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pager */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[11px] text-muted-foreground">
          {rows.length === 0 ? "0 results" : `Showing ${start + 1}–${end} of ${rows.length}`}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 text-xs hover:cursor-pointer">Prev</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setPage((p) => (end < rows.length ? p + 1 : p))}
            disabled={end >= rows.length}
          >
            <span className="mr-1 text-xs hover:cursor-pointer">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------- main component ----------
export default function AnalyticsExplorer({ selectedDateRange }: Props) {
  const { views = [], completions = [], status } = useKnowbyData();
  const isDark = useDarkMode();

  const [metric, setMetric] = useState<Metric>("views");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [selKnowbys, setSelKnowbys] = useState<string[]>([]);
  const [selEmployees, setSelEmployees] = useState<string[]>([]);
  const [usageView, setUsageView] = useState<"knowbys" | "employees">("knowbys");
  const [usageQuery, setUsageQuery] = useState("");
  const [activityPage, setActivityPage] = useState(0);

  const data = useMemo(
    () => buildAnalytics(views as RawRow[], completions as RawRow[], selectedDateRange, selKnowbys, selEmployees, metric),
    [views, completions, selectedDateRange, selKnowbys, selEmployees, metric]
  );

  const options = useMemo(
    () => buildOptions(isDark, chartType, data.gran, data.bins, metric),
    [isDark, chartType, data.gran, data.bins, metric]
  );

  const toggleSelection = (type: "knowbys" | "employees", name: string) => {
    const setter = type === "knowbys" ? setSelKnowbys : setSelEmployees;
    setter((prev) => {
      const exists = prev.includes(name);
      return exists ? prev.filter((n) => n !== name) : [...prev, name];
    });
  };

  const clearUsageSelection = (type: "knowbys" | "employees") => {
    if (type === "knowbys") setSelKnowbys([]);
    else setSelEmployees([]);
  };

  const usageSource = data.usage[usageView];
  const usageResults = useMemo(() => {
    const query = usageQuery.trim().toLowerCase();
    const filtered = query
      ? usageSource.filter((item) => item.name.toLowerCase().includes(query))
      : usageSource;
    const active = filtered.filter((item) => item.views + item.completions > 0);
    const inactive = filtered.filter((item) => item.views + item.completions === 0);
    const totals = filtered.reduce(
      (acc, item) => {
        acc.views += item.views;
        acc.comps += item.completions;
        return acc;
      },
      { views: 0, comps: 0 }
    );
    return { active, inactive, total: filtered.length, totals };
  }, [usageQuery, usageSource]);

  const selectedNames = usageView === "knowbys" ? selKnowbys : selEmployees;
  const hasUsageSelection = selectedNames.length > 0;

  const activityRows = useMemo(() => {
    const rows: SelectionEventRow[] = [];

    const include = (row: RawRow, type: SelectionEventRow["type"]) => {
      const date = parseCsvDate(row.date);
      if (!date) return;

      if (selKnowbys.length && (!row.knowby_name || !selKnowbys.includes(row.knowby_name))) {
        return;
      }
      if (selEmployees.length && (!row.member_name || !selEmployees.includes(row.member_name))) {
        return;
      }

      rows.push({
        knowbyName: row.knowby_name ?? "Unknown knowby",
        employeeName: row.member_name ?? "Unknown member",
        type,
        date,
      });
    };

    data.viewsInRange.forEach((row) => include(row, "view"));
    data.compsInRange.forEach((row) => include(row, "completion"));

    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data.viewsInRange, data.compsInRange, selKnowbys, selEmployees]);

  useEffect(() => {
    setActivityPage(0);
  }, [usageView, selKnowbys.join("|"), selEmployees.join("|"), activityRows.length]);

  useEffect(() => {
    if (!hasUsageSelection) {
      setActivityPage(0);
      return;
    }
    const maxPage = Math.max(0, Math.ceil(activityRows.length / ACTIVITY_PAGE_SIZE) - 1);
    setActivityPage((prev) => (prev > maxPage ? maxPage : prev));
  }, [activityRows.length, hasUsageSelection]);

  const knowbyStats = countActiveInactive(data.usage.knowbys);
  const employeeStats = countActiveInactive(data.usage.employees);
  const summary = summaryCards(knowbyStats, employeeStats);

  const hasKnowbySelection = selKnowbys.length > 0;
  const hasEmployeeSelection = selEmployees.length > 0;

  if (status === "loading") {
    return (
      <Card className="rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card min-h-[340px]" />
    );
  }

  const subtitle = `${format(data.dateStart, "d MMM yyyy")} – ${format(data.dateEnd, "d MMM yyyy")}`;

  return (
    <TooltipProvider>
      <Card className="md:p-5 p-6 rounded-3xl h-fit gap-3 border-0 dark:border dark:border-slate-700 shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 w-full bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-b from-lime-500 to-lime-700">
              <Search className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base md:text-lg dark:text-white font-semibold">Analytics Explorer</h3>
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[11px] text-muted-foreground items-center gap-1">
            <InfoIcon className="h-3 w-3 opacity-60" />
            Metrics shown for chosen time period
          </span>
        </div>

        <CardContent className="p-0">
          <section className="rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-black/10 p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {summary.map((item) => (
                <div
                  key={item.title}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-1.5",
                    "bg-white/60 dark:bg-slate-900/40",
                    "text-xs md:text-sm font-medium",
                    "shadow-sm hover:shadow transition-all",
                    item.className
                  )}
                >
                  <div className="flex flex-col leading-tight">
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                      {item.title}
                    </p>
                    <p className="text-sm md:text-base font-bold">{item.value}</p>
                  </div>
                  <p className="text-[11px] opacity-70">{item.subtitle}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
                {metricButtons(metric, setMetric, chartType, setChartType)}
                <div className="h-[220px] sm:h-[260px] md:h-[280px]">
                  {data.keys.length === 0 ? (
                    <div className="h-full grid place-items-center rounded-lg border border-dashed border-slate-200/70 bg-white/70 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/60">
                      Select a Knowby or keep “All Knowbys” and choose a metric.
                    </div>
                  ) : (
                    <Chart type={chartType} height="100%" options={options} series={data.series as any} />
                  )}
                </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t pt-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <Tabs
                  value={usageView}
                  onValueChange={(v) => setUsageView(v as "knowbys" | "employees")}
                  className="w-full md:w-auto"
                >
                  <TabsList
                    className={cn(
                      "w-full justify-between rounded-lg p-1",
                      "ring-1 ring-black/10 dark:ring-white/10 text-[11px]",
                      "bg-white/60 dark:bg-black/10"
                    )}
                  >
                    <TabsTrigger
                      value="knowbys"
                      className={cn(
                        "flex-1 rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        "text-muted-foreground hover:text-foreground transition-colors",
                        "data-[state=active]:shadow",
                        "[&[data-state=active]]:bg-sky-500 [&[data-state=active]]:text-white",
                        "dark:[&[data-state=active]]:bg-sky-600"
                      )}
                    >
                      Knowbys
                    </TabsTrigger>
                    <TabsTrigger
                      value="employees"
                      className={cn(
                        "flex-1 rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        "text-muted-foreground hover:text-foreground transition-colors",
                        "data-[state=active]:shadow",
                        "[&[data-state=active]]:bg-emerald-500 [&[data-state=active]]:text-white",
                        "dark:[&[data-state=active]]:bg-emerald-600"
                      )}
                    >
                      Employees
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {usageResults.total} result{usageResults.total === 1 ? "" : "s"}
                  </span>
                  <span>
                    {format(data.dateStart, "d MMM")} – {format(data.dateEnd, "d MMM yyyy")}
                  </span>
                </div>
              </div>
              <Input
                value={usageQuery}
                onChange={(event) => setUsageQuery(event.target.value)}
                placeholder={`Search ${usageView === "knowbys" ? "Knowbys" : "Employees"}…`}
                className="h-8 w-full text-sm md:w-56 shadow-sm transition rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <UsageList
                items={usageResults.active}
                selected={selectedNames}
                tone="emerald"
                empty="No recent activity found."
                badge="Recent activity"
                onToggle={(name) => toggleSelection(usageView, name)}
              />
              <UsageList
                items={usageResults.inactive}
                selected={selectedNames}
                tone="violet"
                empty="Everyone here has activity 🎉"
                badge="No Recent Usage"
                onToggle={(name) => toggleSelection(usageView, name)}
              />
            </div>

            <div className="flex flex-col gap-2">
              {/* Selected chips */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="uppercase tracking-wide text-muted-foreground/70">Knowbys</span>
                  {selKnowbys.length === 0 && <span className="text-muted-foreground/60">None selected</span>}
                  {selKnowbys.map((name) => (
                    <Badge
                      key={`knowby-${name}`}
                      variant="outline"
                      className="rounded-full border-sky-300/60 bg-sky-50/70 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/10 dark:text-sky-100"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <span className="uppercase tracking-wide text-muted-foreground/70">Employees</span>
                  {selEmployees.length === 0 && <span className="text-muted-foreground/60">None selected</span>}
                  {selEmployees.map((name) => (
                    <Badge
                      key={`employee-${name}`}
                      variant="outline"
                      className="rounded-full border-emerald-300/60 bg-emerald-50/70 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-100"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Clear actions */}
              <div className="flex flex-wrap items-center gap-3">
                {hasKnowbySelection && (
                  <button
                    type="button"
                    onClick={() => clearUsageSelection("knowbys")}
                    className="text-[11px] font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    Clear knowbys filter
                  </button>
                )}
                {hasEmployeeSelection && (
                  <button
                    type="button"
                    onClick={() => clearUsageSelection("employees")}
                    className="text-[11px] font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    Clear employees filter
                  </button>
                )}
                {(hasKnowbySelection || hasEmployeeSelection) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelKnowbys([]);
                      setSelEmployees([]);
                    }}
                    className="text-[11px] font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>


            <div className="">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Activity Log</div>
                <div className="text-[11px] text-muted-foreground">Log shows data from list above</div>
              </div>

              {hasUsageSelection ? (
                <>
                  <ActivityTable rows={activityRows} page={activityPage} setPage={setActivityPage} pageSize={ACTIVITY_PAGE_SIZE} />
                </>
              ) : (
                <div className="space-y-1 text-[11px] text-muted-foreground/80">
                  <p>Select at least one {usageView === "knowbys" ? "knowby" : "employee"} to review activity events.</p>
                </div>
              )}
            </div>

          </section>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}