"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  parse,
  isWithinInterval,
  differenceInCalendarDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  getDate,
  format,
  startOfYear,
  endOfYear,
  differenceInCalendarWeeks,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { Calendar as CalendarIcon, Eye, CheckCircle } from "lucide-react";

type Props = { selectedDateRange: DateRange | undefined };
type Metric = "views" | "completions" | "both";
type Mode = "weekly" | "monthly" | "yearly" | "all";

/* ---------- small helpers ---------- */

const parseCache = new Map<string, Date>();
function parseCsvDate(ds?: string): Date | null {
  if (!ds) return null;
  let d = parseCache.get(ds);
  if (!d) {
    d = parse(ds, "dd/MM/yyyy", new Date());
    parseCache.set(ds, d);
  }
  return d;
}
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hourKey = (d: Date) => `${dayKey(d)}|${String(d.getHours()).padStart(2, "0")}`;

function clampRange(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  return { start, end };
}
function resolveMode(from: Date, to: Date): Mode {
  const span = differenceInCalendarDays(to, from) + 1;
  if (span <= 14) return "weekly";
  if (span <= 92) return "monthly";
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  if (months <= 18) return "yearly";
  return "all";
}

/** Theme-agnostic cell colors (light + dark) */
function cellColor(value: number, max: number) {
  if (value <= 0 || max <= 0) return "bg-slate-100 dark:bg-white/5";
  const t = value / max;
  if (t < 0.15) return "bg-slate-200 dark:bg-sky-900/40";
  if (t < 0.35) return "bg-sky-200 dark:bg-sky-700/50";
  if (t < 0.6) return "bg-indigo-300 dark:bg-indigo-600/60";
  if (t < 0.85) return "bg-violet-400 dark:bg-violet-600/70";
  return "bg-fuchsia-500 text-white dark:bg-fuchsia-500/80 shadow-[0_2px_10px_-4px] shadow-fuchsia-400/40 dark:shadow-[0_0_12px] dark:shadow-fuchsia-500/30";
}

export default function UsageHeatmap({ selectedDateRange }: Props) {
  /* --- ALWAYS call hooks in the same order (no early return before these) --- */
  const { views, completions } = useKnowbyData();            // <- useContext runs every render
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [metric, setMetric] = useState<Metric>("views");

  // Use stable fallback dates so hook computations don’t depend on runtime time.
  const rawFrom = selectedDateRange?.from ?? new Date(0);    // epoch -> stable on SSR & CSR
  const rawTo   = selectedDateRange?.to   ?? new Date(0);
  const { start, end } = clampRange(rawFrom, rawTo);
  const ready = mounted && !!selectedDateRange?.from && !!selectedDateRange?.to;
  const mode: Mode = resolveMode(start, end);

  /* ---------- aggregate once (guarded by `ready`) ---------- */
  const counts = useMemo(() => {
    const dayViews = new Map<string, number>();
    const dayComps = new Map<string, number>();
    const hourViews = new Map<string, number>();
    const hourComps = new Map<string, number>();

    if (!ready) {
      return { dayViews, dayComps, hourViews, hourComps };
    }

    const push = (d: Date | null, kind: "v" | "c") => {
      if (!d) return;
      if (!isWithinInterval(d, { start, end })) return;
      const dk = dayKey(d);
      const hk = hourKey(d);
      if (kind === "v") {
        dayViews.set(dk, (dayViews.get(dk) ?? 0) + 1);
        hourViews.set(hk, (hourViews.get(hk) ?? 0) + 1);
      } else {
        dayComps.set(dk, (dayComps.get(dk) ?? 0) + 1);
        hourComps.set(hk, (hourComps.get(hk) ?? 0) + 1);
      }
    };

    for (const r of views) push(parseCsvDate((r as any)?.date), "v");
    for (const r of completions) push(parseCsvDate((r as any)?.date), "c");

    return { dayViews, dayComps, hourViews, hourComps };
  }, [views, completions, start.getTime(), end.getTime(), ready]);

  const dayCount = (d: Date) => {
    const k = dayKey(d);
    const v = counts.dayViews.get(k) ?? 0;
    const c = counts.dayComps.get(k) ?? 0;
    return metric === "views" ? v : metric === "completions" ? c : v + c;
  };
  const hourCount = (d: Date) => {
    const k = hourKey(d);
    const v = counts.hourViews.get(k) ?? 0;
    const c = counts.hourComps.get(k) ?? 0;
    return metric === "views" ? v : metric === "completions" ? c : v + c;
  };

  /* ---------- data shapes (guarded; cheap when !ready) ---------- */
  const weekly = useMemo(() => {
    if (!ready) return { days: [] as Date[], grid: [] as number[][], max: 0 };
    const days = eachDayOfInterval({ start, end }).slice(0, 14);
    const grid: number[][] = Array.from({ length: 24 }, () => Array(days.length).fill(0));
    let max = 0;
    for (let c = 0; c < days.length; c++) {
      for (let h = 0; h < 24; h++) {
        const t = new Date(days[c].getFullYear(), days[c].getMonth(), days[c].getDate(), h);
        const v = hourCount(t);
        grid[h][c] = v;
        if (v > max) max = v;
      }
    }
    return { days, grid, max };
  }, [start.getTime(), end.getTime(), metric, counts, ready]);

  const months = useMemo(() => {
    if (!ready) return [] as { monthStart: Date; days: Date[]; max: number }[];
    const first = startOfMonth(start);
    const last = endOfMonth(end);
    const out: { monthStart: Date; days: Date[]; max: number }[] = [];
    let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    while (cursor <= last) {
      const mStart = startOfMonth(cursor);
      const mEnd = endOfMonth(cursor);
      const calStart = startOfWeek(mStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
      const ds = eachDayOfInterval({ start: calStart, end: calEnd });
      let max = 0;
      for (const d of ds) max = Math.max(max, dayCount(d));
      out.push({ monthStart: mStart, days: ds, max });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out;
  }, [start.getTime(), end.getTime(), metric, counts, ready]);

  const yearly = useMemo(() => {
    if (!ready) return [] as { year: number; start: Date; end: Date; weeks: number; matrix: number[][]; max: number }[];
    const ys: { year: number; start: Date; end: Date; weeks: number; matrix: number[][]; max: number }[] = [];
    for (let y = startOfYear(start).getFullYear(); y <= endOfYear(end).getFullYear(); y++) {
      const yStart = startOfWeek(startOfYear(new Date(y, 0, 1)), { weekStartsOn: 0 });
      const yEnd = endOfWeek(endOfYear(new Date(y, 11, 31)), { weekStartsOn: 0 });
      const weeks = differenceInCalendarWeeks(yEnd, yStart, { weekStartsOn: 0 }) + 1;
      const matrix: number[][] = Array.from({ length: 7 }, () => Array(weeks).fill(0));
      let max = 0;
      for (let w = 0; w < weeks; w++) {
        const colStart = addDays(yStart, w * 7);
        for (let r = 0; r < 7; r++) {
          const d = addDays(colStart, r);
          const v = isWithinInterval(d, { start, end }) ? dayCount(d) : 0;
          matrix[r][w] = v;
          if (v > max) max = v;
        }
      }
      ys.push({ year: y, start: yStart, end: yEnd, weeks, matrix, max });
    }
    return ys;
  }, [start.getTime(), end.getTime(), metric, counts, ready]);

  /* ---------- Skeleton (after all hooks have been called) ---------- */
  if (!ready) {
    return (
      <Card className="relative isolate overflow-hidden rounded-3xl p-5 border-0 shadow-xl/2 bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-b from-pink-500 to-fuchsia-500 dark:from-rose-500 dark:to-rose-600" />
          <div className="flex-1">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-3 w-56 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      </Card>
    );
  }

  /* ---------- UI ---------- */
  return (
    <TooltipProvider>
      <Card className="relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card dark:border dark:border-slate-700 gap-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-b from-amber-500 to-orange-500 dark:from-rose-500 dark:to-rose-600">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-base md:text-lg font-semibold">Usage Heatmap</h3>
            <span className="text-xs text-muted-foreground">
              {format(start, "d MMM yyyy")} – {format(end, "d MMM yyyy")}
            </span>
          </div>

          {/* Metric chips */}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <button
              onClick={() => setMetric("views")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 transition
              ${"bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-white/10"}
              ${metric === "views" ? "font-semibold" : "opacity-35"}`}
              title="Show views"
            >
              <Eye className="h-3.5 w-3.5" /> Views
            </button>
            <button
              onClick={() => setMetric("completions")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 transition
              ${"bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-white/10"}
              ${metric === "completions" ? "font-semibold" : "opacity-35"}`}
              title="Show completions"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Completions
            </button>
            <button
              onClick={() => setMetric("both")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 transition
              ${"bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:ring-white/10"}
              ${metric === "both" ? "font-semibold" : "opacity-35"}`}
              title="Show both"
            >
              Views + Comp
            </button>
          </div>
        </div>

        {/* WEEKLY (<=14 days): hours × day */}
        {mode === "weekly" && (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="pl-10">Hourly activity</span>
              <span>
                {format(startOfWeek(start), "d MMM")} – {format(endOfWeek(end), "d MMM yyyy")}
              </span>
            </div>
            <div className="grid grid-cols-[auto,1fr] gap-2">
              <div className="grid grid-rows-24 gap-1 pr-2">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="h-6 text-[10px] text-muted-foreground/80">{h}:00</div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${weekly.days.length}, minmax(1.5rem,1fr))`, gap: 4 }}>
                  {weekly.days.map((d, c) => (
                    <div key={c} className="flex flex-col">
                      <div className="mb-1 text-center text-[11px] text-muted-foreground">{format(d, "EEE d")}</div>
                      <div className="grid grid-rows-24 gap-1">
                        {Array.from({ length: 24 }, (_, r) => {
                          const v = weekly.grid[r][c];
                          const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), r);
                          return (
                            <Tooltip key={r}>
                              <TooltipTrigger asChild>
                                <div className={`h-6 w-6 rounded-md ${cellColor(v, weekly.max)} ring-1 ring-black/10 dark:ring-white/10`} />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {format(t, "EEE d MMM, HH:00")} — {v} {metric === "completions" ? "completion(s)" : metric === "views" ? "view(s)" : "event(s)"}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Legend />
          </>
        )}

        {/* MONTHLY: stacked calendars */}
        {mode === "monthly" && (
          <div className="space-y-6">
            {months.map(({ monthStart, days, max }) => (
              <div key={monthStart.toISOString()} className="rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{format(monthStart, "MMMM yyyy")}</div>
                  <div className="text-xs text-muted-foreground">Sun – Sat</div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <div key={d} className="text-[11px] text-center text-muted-foreground mb-1">{d}</div>
                  ))}
                  {days.map((d) => {
                    const v = dayCount(d);
                    const faint = !isSameMonth(d, monthStart);
                    return (
                      <Tooltip key={d.toISOString()}>
                        <TooltipTrigger asChild>
                          <div className={`relative h-8 rounded-md ${cellColor(v, max)} ring-1 ring-black/10 dark:ring-white/10 ${faint ? "opacity-45" : ""}`}>
                            <span className="absolute left-1 top-1 text-[10px] select-none text-slate-700 dark:text-white/70">
                              {getDate(d)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {format(d, "EEE d MMM yyyy")} — {v} {metric === "completions" ? "completion(s)" : metric === "views" ? "view(s)" : "event(s)"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
            <Legend />
          </div>
        )}

        {/* YEARLY + ALL: GitHub-style */}
        {(mode === "yearly" || mode === "all") && (
          <div className="space-y-6">
            {yearly.map((y) => (
              <div key={y.year} className="rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{y.year}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(y.start, "d MMM")} – {format(y.end, "d MMM")}
                  </div>
                </div>
                <div className="inline-grid gap-1" style={{ gridTemplateRows: "repeat(7,1fr)", gridTemplateColumns: `repeat(${y.weeks}, 1fr)` }}>
                  {Array.from({ length: 7 }, (_, r) =>
                    Array.from({ length: y.weeks }, (_, c) => {
                      const day = addDays(y.start, c * 7 + r);
                      const v = y.matrix[r][c];
                      return (
                        <Tooltip key={`${r}-${c}`}>
                          <TooltipTrigger asChild>
                            <div className={`h-3.5 w-3.5 rounded-[6px] ${cellColor(v, y.max)} ring-1 ring-black/10 dark:ring-white/10`} />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            {format(day, "EEE d MMM yyyy")} — {v} {metric === "completions" ? "completion(s)" : metric === "views" ? "view(s)" : "event(s)"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
            <Legend />
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}

/* ---------- shared legend ---------- */
function Legend() {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-xs text-muted-foreground">Low</span>
      <div className="h-2 w-44 rounded-full bg-gradient-to-r from-slate-200 via-sky-300 via-70% to-fuchsia-500 dark:from-sky-900 dark:via-indigo-600 dark:via-70% dark:to-fuchsia-500/90" />
      <span className="text-xs text-muted-foreground">High</span>
    </div>
  );
}
