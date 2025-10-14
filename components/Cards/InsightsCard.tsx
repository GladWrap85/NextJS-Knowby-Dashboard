// components/Cards/AnalyticsExplorer.tsx
"use client";

import React, { useMemo, useState, useCallback } from "react";
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
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { useDarkMode } from "@/components/NivoWrapper";
import { topChartOptions } from "@/lib/chartOptions";
import type { ApexOptions } from "apexcharts";
import {
  Eye, CheckCircle, Download, TrendingUp,
  BarChart3, LineChart,
  ArrowUpRight, ArrowDownRight, Search, ChevronDown, X
} from "lucide-react";
import { cn } from "@/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ---------------- Types ----------------
type Props = { selectedDateRange: DateRange | undefined };
type Metric = "views" | "completions" | "completionRate" | "both";
type ChartType = "area" | "bar";

// ---------------- Helpers ----------------
const parseCache = new Map<string, Date>();
const parseCsvDate = (d?: string) => {
  if (!d) return null;
  const hit = parseCache.get(d); if (hit) return hit;
  const dt = parseDateFn(d, "dd/MM/yyyy", new Date());
  if (!isNaN(dt.getTime())) parseCache.set(d, dt);
  return isNaN(dt.getTime()) ? null : dt;
};

const pill = (active: boolean, tone: "views" | "completions" | "both" | "neutral" = "neutral") =>
  `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 transition whitespace-nowrap ${({
    views: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-white/10",
    completions: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-white/10",
    both: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-white/10",
    neutral: "bg-muted/50 text-foreground/80 ring-black/10 dark:ring-white/10",
  } as const)[tone]
  } ${active ? "font-semibold" : "opacity-35 hover:opacity-90"}`;

const chip = "rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/60 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10";

// =========================================================
// Clean, reusable Multi-Select Dropdown (keyboard + search)
// =========================================================

type MultiSelectDropdownProps = {
  label: string;
  placeholder: string;
  options: string[];                  // unique, display values
  selected: string[];                 // controlled selection
  onChange: (next: string[]) => void; // controlled setter
  max?: number;                       // optional selection cap
  className?: string;
};

function MultiSelectDropdown({
  label, placeholder, options, selected, onChange, max,
  className,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(q.toLowerCase())),
    [options, q]
  );

  const canAddMore = max ? selected.length < max : true;
  const isOn = useCallback((name: string) => selected.includes(name), [selected]);

  const toggle = (name: string) => {
    onChange(
      isOn(name)
        ? selected.filter(n => n !== name)
        : (canAddMore ? [...selected, name] : selected)
    );
  };

  const clearAll = () => onChange([]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full inline-flex items-center justify-between rounded-lg bg-background/60 dark:bg-white/5",
              "ring-1 ring-black/10 dark:ring-white/10 px-2.5 py-1.5 text-sm hover:bg-accent transition"
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search className="h-4 w-4 opacity-60 shrink-0" />
              <span className="truncate opacity-80">
                {selected.length ? selected.join(", ") : placeholder}
              </span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected.length > 0 && (
                <Badge variant="secondary" className={chip}>{selected.length}</Badge>
              )}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(560px,90vw)] p-0" sideOffset={6}>
          {/* Search + Clear */}
          <div className="p-2 pb-0">
            <Command shouldFilter>
              <CommandInput
                value={q}
                onValueChange={setQ}
                placeholder={placeholder}
                className="w-full"
              />
            </Command>
            {selected.length > 0 && (
              <div className="px-1 pt-1 pb-0 flex justify-end">
                <button
                  onClick={clearAll}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* All row */}
          <div className="px-2 pt-2">
            <button
              onClick={clearAll}
              className="w-full inline-flex items-center justify-between rounded-md px-2.5 py-2 text-sm ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-white/5 hover:bg-muted transition"
            >
              <span>All {label}</span>
              {selected.length === 0 && <CheckCircle className="h-4 w-4" />}
            </button>
          </div>

          {/* List */}
          <div className="p-2">
            <Command shouldFilter>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {filtered.map((o) => {
                  const on = isOn(o);
                  const disabled = !on && !canAddMore;
                  return (
                    <CommandItem key={o} value={o} onSelect={() => !disabled && toggle(o)}
                      className={cn(
                        "group flex items-center justify-between rounded-md px-2.5 py-2 text-sm",
                        "ring-1 ring-black/10 dark:ring-white/10",
                        on
                          ? "bg-primary/10 dark:bg-primary/15 border border-primary/30"
                          : "bg-muted/40 hover:bg-muted/60",
                        disabled && "opacity-40 cursor-not-allowed"
                      )}
                      aria-selected={on}
                    >
                      <span className="truncate">{o}</span>
                      <span
                        className={cn(
                          "ml-2 inline-grid place-items-center h-5 w-5 rounded-[6px] ring-1",
                          on ? "bg-primary/20 ring-primary/40" : "bg-white/40 dark:bg-white/5 ring-black/10 dark:ring-white/10"
                        )}
                      >
                        {on ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-[4px] ring-1 ring-black/10 dark:ring-white/10" />
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </Command>
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 border-t border-border">
              {selected.map((n) => (
                <span key={n} className={chip}>
                  {n}
                  <button className="ml-1 inline-flex" onClick={() => onChange(selected.filter(x => x !== n))}>
                    <X className="h-3 w-3 opacity-70" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------- Main Component ----------------
export default function AnalyticsExplorer({ selectedDateRange }: Props) {
  const { views, completions, status } = useKnowbyData();
  const isDark = useDarkMode();

  const [metric, setMetric] = useState<Metric>("views");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [selKnowbys, setSelKnowbys] = useState<string[]>([]);
  const [selEmployees, setSelEmployees] = useState<string[]>([]);

  // Derive everything with timestamped bins (day/week/month)
  const computed = useMemo(() => {
    const all = [...(views ?? []), ...(completions ?? [])];
    const dMin = all.reduce<Date | null>((acc, r: any) => {
      const d = parseCsvDate(r?.date); return !acc || (d && d < acc) ? d : acc;
    }, null) ?? new Date();

    const dateStart = selectedDateRange?.from ?? dMin;
    const dateEnd = selectedDateRange?.to ?? new Date();
    const inRange = (d: Date | null) => !!d && isWithinInterval(d, { start: startOfDay(dateStart), end: endOfDay(dateEnd) });

    const filterRows = (rows: any[]) => rows.filter(r => {
      const d = parseCsvDate(r?.date); if (!inRange(d)) return false;
      const kOK = selKnowbys.length === 0 || selKnowbys.includes(r?.knowby_name);
      const eOK = selEmployees.length === 0 || selEmployees.includes(r?.member_name);
      return kOK && eOK;
    });

    const viewsF = filterRows(views ?? []);
    const compsF = filterRows(completions ?? []);

    // granularity
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

    // bins
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

    const allKnowbys = Array.from(new Set<string>([...viewsF, ...compsF].map(r => r?.knowby_name).filter(Boolean))).sort();
    const allEmployees = Array.from(new Set<string>([...viewsF, ...compsF].map(r => r?.member_name).filter(Boolean))).sort();

    const names = (selKnowbys.length > 0 ? selKnowbys : ["All Knowbys"]);
    const makeCount = (rows: any[], name: string, b: Bin) =>
      rows.filter((r: any) => {
        const d = parseCsvDate(r?.date);
        const ok = name === "All Knowbys" || r?.knowby_name === name;
        return ok && d && isWithinInterval(d, { start: b.start, end: b.end });
      }).length;

    // keys
    const keys = names.flatMap(n =>
      metric === "both" ? [`${n} Views`, `${n} Completions`]
        : metric === "views" ? [`${n} Views`]
          : metric === "completions" ? [`${n} Completions`]
            : [`${n} Completion Rate`]
    );

    // series
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

    const top3 = (rows: any[], key: "knowby_name" | "member_name") =>
      Object.entries(rows.reduce<Record<string, number>>((m, r: any) => { const k = r[key] ?? "Unknown"; m[k] = (m[k] ?? 0) + 1; return m; }, {}))
        .sort((a, b) => b[1] - a[1]).slice(0, 3);

    // trend
    const firstKey = keys[0];
    let trend: "up" | "down" | "neutral" = "neutral";
    if (firstKey) {
      const s = tsSeries.find(s => s.name === firstKey)?.data ?? [];
      if (s.length >= 2) {
        const last = s[s.length - 1][1];
        const prev = s[s.length - 2][1];
        trend = last > prev ? "up" : last < prev ? "down" : "neutral";
      }
    }

    return {
      dateStart, dateEnd, gran,
      bins, tsSeries, keys,
      allKnowbys, allEmployees, avgRate,
      topKnowbys: top3(compsF, "knowby_name"),
      topEmployees: top3(compsF, "member_name"),
      totals, trend
    };
  }, [views, completions, selectedDateRange, selKnowbys, selEmployees, metric]);

  const series = computed.tsSeries;

  // --- Chart options aligned with TodaysUsageCard ---
  const options = useMemo<ApexOptions>(() => {
    const base = topChartOptions(isDark);

    // date format for x-axis / tooltip depending on bucket
    const xLabelFormat =
      computed.gran === "month" ? "MMM yyyy" :
        computed.gran === "week" ? "dd MMM" :
          "dd MMM";

    return {
      ...base,
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
        labels: {
          ...(base.xaxis?.labels ?? {}),
          rotate: -15,
          format: xLabelFormat,
        },
      },
      yaxis: {
        ...(base.yaxis ?? {}),
        min: 0,
        max: metric === "completionRate" ? 100 : undefined,
        labels: {
          ...(Array.isArray(base.yaxis) ? {} : base.yaxis?.labels ?? {}),
          formatter: (v: number) => (metric === "completionRate" ? `${v}%` : `${v}`),
        },
      },
      grid: {
        ...(base.grid ?? {}),
        padding: { ...base.grid?.padding, right: 8 },
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
              return b ? `${format(b.start, "dd MMM")} – ${format(b.end, "dd MMM yyyy")}` : format(new Date(ts), "dd MMM yyyy");
            }
            return format(new Date(ts), "MMM yyyy");
          }
        },
        y: { formatter: (v: number) => (metric === "completionRate" ? `${v}%` : String(v)) },
      },
    };
  }, [isDark, chartType, computed.gran, computed.bins, metric]);

  // ---------------- Export ----------------
  const exportCsv = () => {
    const mk = (rows: string[][]) => {
      const csv = rows.map(r => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "analytics-explorer.csv";
      a.click(); URL.revokeObjectURL(url);
    };

    const headers = ["timestamp", ...computed.keys];
    const tsSet = new Set<number>();
    series.forEach(s => s.data.forEach(([ts]: any) => tsSet.add(ts)));
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
    const rows = sortedTs.map(ts => {
      const row: Record<string, string | number> = { timestamp: ts };
      for (const k of computed.keys) {
        const s = series.find(s => s.name === k)?.data ?? [];
        const v = s.find(([t]: any) => t === ts)?.[1] ?? "";
        row[k] = v;
      }
      return headers.map(h => String(row[h] ?? ""));
    });
    mk([headers, ...rows]);
  };

  // ---------------- UI ----------------
  if (status === "loading") {
    return (
      <Card className="flex flex-col p-6 rounded-3xl h-fit gap-3 border-0 dark:border dark:border-slate-700 shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 w-full bg-card min-h-[365px]">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-60 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 w-24 bg-muted rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          <div className="h-9 w-full bg-muted rounded-md animate-pulse" />
          <div className="h-9 w-full bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-[240px] rounded-md bg-muted animate-pulse" />
      </Card>
    );
  }

  const subtitle =
    `${format((computed as any).dateStart, "d MMM yyyy")} – ${format((computed as any).dateEnd, "d MMM yyyy")} • ${(computed as any).gran.toUpperCase()} buckets • ${metric}`;

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-3xl h-fit gap-4 border-0 dark:border dark:border-slate-700 shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 w-full bg-card">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full text-white bg-gradient-to-b from-lime-500 to-lime-700">
              <Search className="h-8 w-8" />
            </div>

            <div className="flex flex-col gap-0 w-full min-w-0">
              <h3 className="text-lg font-semibold dark:text-white">Analytics Explorer</h3>
              <span className="text-xs text-muted-foreground">{subtitle}</span>

              {/* Quick summary */}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{computed.totals.views}</strong> views
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{computed.totals.comps}</strong> completions
                </span>
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{computed.avgRate}%</strong> avg rate
                  {computed.trend === "up" && <ArrowUpRight className="inline h-3.5 w-3.5 text-green-500" />}
                  {computed.trend === "down" && <ArrowDownRight className="inline h-3.5 w-3.5 text-red-500" />}
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Metrics use date range at top</span>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {/* LEFT: metric filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button className={cn(pill(metric === "views", "views"), "hover:cursor-pointer")} onClick={() => setMetric("views")} title="Show Views">
              <Eye className="h-4 w-4" /> Views
            </button>
            <button className={cn(pill(metric === "completions", "completions"), "hover:cursor-pointer")} onClick={() => setMetric("completions")} title="Show Completions">
              <CheckCircle className="h-4 w-4" /> Completions
            </button>
            <button className={cn(pill(metric === "both", "both"), "hover:cursor-pointer")} onClick={() => setMetric("both")} title="Views + Completions">
              <Eye className="h-4 w-4" /> + <CheckCircle className="h-4 w-4" />
            </button>
            <button className={cn(pill(metric === "completionRate", "neutral"), "hover:cursor-pointer")} onClick={() => setMetric("completionRate")} title="Completion Rate">
              <TrendingUp className="h-4 w-4" /> Rate
            </button>
          </div>

          {/* RIGHT: chart types + export */}
          <div className="flex flex-wrap items-center gap-2">
            <button className={pill(chartType === "area")} onClick={() => setChartType("area")} title="Area chart">
              <LineChart className="h-4 w-4" /> Area
            </button>
            <button className={pill(chartType === "bar")} onClick={() => setChartType("bar")} title="Bar chart">
              <BarChart3 className="h-4 w-4" /> Bar
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className={pill(true)} onClick={exportCsv} title="Export visible data">
                  <Download className="h-4 w-4" /> Export
                </button>
              </TooltipTrigger>
              <TooltipContent>Export visible data</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Searches (Knowbys / Employees) */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <MultiSelectDropdown
            label="Knowbys"
            placeholder="Search Knowbys…"
            options={computed.allKnowbys}
            selected={selKnowbys}
            onChange={setSelKnowbys}
            max={4}
          />
          <MultiSelectDropdown
            label="Employees"
            placeholder="Search Employees…"
            options={computed.allEmployees}
            selected={selEmployees}
            onChange={setSelEmployees}
            max={4}
          />
        </div>

        {/* Chart + Insights */}
        <CardContent className="p-0">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <div className="h-[400px] rounded-lg bg-transparent -mt-2">
                {computed.keys.length === 0
                  ? <div className="h-full grid place-items-center opacity-70 text-sm">Select a Knowby or keep “All Knowbys” and choose a metric.</div>
                  : <Chart type={chartType} height={400} options={options} series={series as any} />
                }
              </div>
            </div>

            <div className="xl:col-span-1 flex flex-col gap-4 border-l pl-6 dark:border-slate-800">
              <div className="rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold text-sm mb-2">Key Insights</h3>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Avg. Completion Rate</p>
                  <p className="text-lg font-semibold">
                    {computed.avgRate}%{" "}
                    {computed.trend === "up" && <ArrowUpRight className="inline h-4 w-4 text-green-500" />}
                    {computed.trend === "down" && <ArrowDownRight className="inline h-4 w-4 text-red-500" />}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Top Knowbys</p>
                  <ul className="text-sm space-y-1">
                    {computed.topKnowbys.length ? computed.topKnowbys.map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span className="truncate">{k}</span><span className="text-muted-foreground">{v}</span></li>
                    )) : <li className="opacity-60">No data</li>}
                  </ul>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Top Employees</p>
                  <ul className="text-sm space-y-1">
                    {computed.topEmployees.length ? computed.topEmployees.map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span className="truncate">{k}</span><span className="text-muted-foreground">{v}</span></li>
                    )) : <li className="opacity-60">No data</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
