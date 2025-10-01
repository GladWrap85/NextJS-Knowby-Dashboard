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
import clsx from "clsx";

type Props = { selectedDateRange: DateRange | undefined };
type Metric = "views" | "completions" | "both";
type Mode = "weekly" | "monthly" | "yearly" | "all";

/* ---------- small helpers ---------- */

const parseCache = new Map<string, Date>();
function parseCsvDateTime(
  dateStr?: string,
  timeStr?: string,
  isoDateTimeStr?: string
): Date | null {
  // Prefer ISO datetime if present (e.g. from the provider)
  if (isoDateTimeStr) {
    const d = new Date(isoDateTimeStr);
    if (!isNaN(d.getTime())) return d;
  }
  if (!dateStr) return null;

  // Parse dd/MM/yyyy -> local date
  const [dd, mm, yyyy] = String(dateStr).split("/").map((x) => parseInt(String(x).trim(), 10));
  if (!yyyy || !mm || !dd) return null;
  const d = new Date(yyyy, mm - 1, dd);

  // Apply time if available (HH:mm or HH:mm:ss)
  if (timeStr) {
    const [hh = "0", m = "0", s = "0"] = String(timeStr).split(":");
    d.setHours(parseInt(hh, 10) || 0, parseInt(m, 10) || 0, parseInt(s, 10) || 0, 0);
  }
  return d;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hourKey = (d: Date) => `${dayKey(d)}|${String(d.getHours()).padStart(2, "0")}`;

// 8 equal bins across 24h (= 180 min each)
const WEEKLY_BINS = 8;
type TimeBin = { startMin: number; endMin: number; label: string };

// e.g. 0 -> "00:00", 180 -> "03:00"
function fmtHM(totalMin: number) {
  const m = Math.min(totalMin, 24 * 60); // clamp at 24:00
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function buildTimeBins(n = WEEKLY_BINS): TimeBin[] {
  const minutesPerBin = (24 * 60) / n; // 1440 / 8 = 180
  const bins: TimeBin[] = [];
  for (let i = 0; i < n; i++) {
    const startMin = Math.round(i * minutesPerBin);
    const endMin = i === n - 1 ? 24 * 60 : Math.round((i + 1) * minutesPerBin);
    bins.push({ startMin, endMin, label: `${fmtHM(startMin)}–${fmtHM(endMin)}` });
  }
  return bins;
}

const TIME_BINS = buildTimeBins(WEEKLY_BINS);

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

/** Ramps that match your dashboard semantics */
const RAMPS: Record<Metric, string[]> = {
  views: [
    "bg-slate-100 dark:bg-white/5",            // 0 or no max
    "bg-sky-100 dark:bg-sky-900/30",           // very low
    "bg-sky-200 dark:bg-sky-800/40",           // low
    "bg-sky-300 dark:bg-sky-700/50",           // med
    "bg-sky-400 dark:bg-sky-600/60",           // high
    "bg-sky-500 text-white dark:bg-sky-500/80 shadow-[0_2px_10px_-4px] shadow-sky-400/40 dark:shadow-[0_0_12px] dark:shadow-sky-500/30", // very high
  ],
  completions: [
    "bg-slate-100 dark:bg-white/5",
    "bg-emerald-100 dark:bg-emerald-950/30",
    "bg-emerald-200 dark:bg-emerald-900/40",
    "bg-emerald-300 dark:bg-emerald-800/50",
    "bg-emerald-400 dark:bg-emerald-700/60",
    "bg-emerald-500 text-white dark:bg-emerald-500/80 shadow-[0_2px_10px_-4px] shadow-emerald-400/40 dark:shadow-[0_0_12px] dark:shadow-emerald-500/30",
  ],
  both: [
    "bg-slate-100 dark:bg-white/5",
    "bg-violet-100 dark:bg-violet-950/30",
    "bg-violet-200 dark:bg-violet-900/40",
    "bg-violet-300 dark:bg-violet-800/50",
    "bg-violet-400 dark:bg-violet-700/60",
    "bg-violet-500 text-white dark:bg-violet-500/80 shadow-[0_2px_10px_-4px] shadow-violet-400/40 dark:shadow-[0_0_12px] dark:shadow-violet-500/30",
  ],
};

/** Theme-agnostic cell colors that switch by metric */
export function cellColor(value: number, max: number, metric: Metric) {
  const ramp = RAMPS[metric];
  if (value <= 0 || max <= 0) return ramp[0];
  const t = value / max;
  if (t < 0.15) return ramp[1];
  if (t < 0.35) return ramp[2];
  if (t < 0.6)  return ramp[3];
  if (t < 0.85) return ramp[4];
  return ramp[5];
}


export default function UsageHeatmap({ selectedDateRange }: Props) {
  /* --- ALWAYS call hooks in the same order (no early return before these) --- */
  const { views, completions } = useKnowbyData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [metric, setMetric] = useState<Metric>("views");

  // Use stable fallback dates so hook computations don’t depend on runtime time.
  const rawFrom = selectedDateRange?.from ?? new Date(0);
  const rawTo = selectedDateRange?.to ?? new Date(0);
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

    for (const r of views) {
      const d =
        (r as any)?.parsedDateTime
        ?? parseCsvDateTime((r as any)?.date, (r as any)?.time, (r as any)?.datetime);
      push(d, "v");
    }
    for (const r of completions) {
      const d =
        (r as any)?.parsedDateTime
        ?? parseCsvDateTime((r as any)?.date, (r as any)?.time, (r as any)?.datetime);
      push(d, "c");
    }

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
    if (!ready) return { days: [] as Date[], grid: [] as number[][], max: 0, bins: TIME_BINS };

    const days = eachDayOfInterval({ start, end }).slice(0, 14);
    const rows = TIME_BINS.length; // now 8
    const grid: number[][] = Array.from({ length: rows }, () => Array(days.length).fill(0));
    let max = 0;

    // For each day/each bin, sum all hour buckets whose hour start falls inside the bin range
    for (let c = 0; c < days.length; c++) {
      const d = days[c];
      for (let r = 0; r < rows; r++) {
        const bin = TIME_BINS[r];
        let sum = 0;
        for (let h = 0; h < 24; h++) {
          const hourStartMin = h * 60;
          if (hourStartMin >= bin.startMin && hourStartMin < bin.endMin) {
            const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);
            sum += hourCount(t);
          }
        }
        grid[r][c] = sum;
        if (sum > max) max = sum;
      }
    }

    return { days, grid, max, bins: TIME_BINS };
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
      <Card className="min-h-[365px] max-h-[365px] relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card dark:border dark:border-slate-700 gap-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-b from-teal-500 to-teal-700">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-base md:text-lg dark:text-white font-semibold">Usage Heatmap</h3>
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
            <div className="overflow-x-auto rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `auto repeat(${weekly.days.length}, minmax(1.5rem, 1fr))`,
                  gridTemplateRows: `auto repeat(${weekly.bins.length}, 1fr)`,
                  gap: 4,
                }}
              >
                <div />
                {weekly.days.map((d, c) => (
                  <div
                    key={`head-${c}`}
                    className="text-center text-[11px] text-muted-foreground"
                    style={{ gridColumn: c + 2, gridRow: 1 }}
                  >
                    {format(d, "EEE d")}
                  </div>
                ))}
                {weekly.bins.map((b, r) => (
                  <div
                    key={`lbl-${r}`}
                    className="text-[10px] text-muted-foreground/80 flex items-center"
                    style={{ gridColumn: 1, gridRow: r + 2 }}
                  >
                    {b.label}
                  </div>
                ))}
                {weekly.days.map((d, c) =>
                  weekly.bins.map((bin, r) => {
                    const v = weekly.grid[r][c];
                    const midMin = Math.floor((bin.startMin + bin.endMin) / 2);
                    const hh = Math.floor(midMin / 60);
                    const mm = midMin % 60;
                    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
                    return (
                      <Tooltip key={`${c}-${r}`}>
                        <TooltipTrigger asChild>
                          <div className={`h-5 w-auto rounded-md ${cellColor(v, weekly.max, metric)} ring-1 ring-black/10 dark:ring-white/10`}
                            style={{ gridColumn: c + 2, gridRow: r + 2 }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {format(d, "EEE d MMM")} • {bin.label} — {v}{" "}
                          {metric === "completions" ? "completion(s)" : metric === "views" ? "view(s)" : "event(s)"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                )}
              </div>
            </div>
            <Legend />
          </>
        )}

        {/* MONTHLY: stacked calendars */}
        {mode === "monthly" && (
          <div className="space-y-2">
            {months.map(({ monthStart, days, max }) => (
              <div key={monthStart.toISOString()} className="rounded-2xl ring-1 ring-black/10 dark:ring-white/10 p-3 bg-white/60 dark:bg-black/10">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{format(monthStart, "MMMM yyyy")}</div>
                  <div className="text-xs text-muted-foreground">Sun – Sat</div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-[11px] text-center text-muted-foreground mb-1">{d}</div>
                  ))}
                  {days.map((d) => {
                    const v = dayCount(d);
                    const faint = !isSameMonth(d, monthStart);
                    return (
                      <Tooltip key={d.toISOString()}>
                        <TooltipTrigger asChild>
                          <div className={clsx(`relative h-7 rounded-md ${cellColor(v, max, metric)} ring-1 ring-black/10 dark:ring-white/10`, faint && "opacity-45" )}>
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

        {/* YEARLY + ALL: width-fitting micro-cells (no overflow, no extra height) */}
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

                {/* 
                  Width-fitting grid:
                  - Columns: repeat(weeks, 1fr) -> always fits container width
                  - Rows: fixed tiny height per weekday (no extra vertical space)
                  - Gap: minimal (0.125rem) to keep legibility at tiny widths
                  - Cells: full column width, height ~6px (h-1.5), rounded for a modern “spark-heatmap” look
                */}
                <div
                  className="grid gap-[2px]"
                  style={{
                    gridTemplateRows: "repeat(7, 24px)", // ~h-1.5 each row; keep card height constant
                    gridTemplateColumns: `repeat(${y.weeks}, 1fr)`,
                  }}
                >
                  {Array.from({ length: 7 }, (_, r) =>
                    Array.from({ length: y.weeks }, (_, c) => {
                      const day = addDays(y.start, c * 7 + r);
                      const v = y.matrix[r][c];
                      return (
                        <Tooltip key={`${r}-${c}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-full h-[24px] rounded-[2px] ${cellColor(v, y.max, metric)} ring-0`}
                              // No fixed width -> column width defines it, preventing overflow
                            />
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
    <div className="mt-0 flex items-center gap-3">
      <span className="text-xs text-muted-foreground">Low</span>
      <div className="h-2 w-44 rounded-full bg-gradient-to-r from-slate-200 via-sky-300 via-70% to-fuchsia-500 dark:from-sky-900 dark:via-indigo-600 dark:via-70% dark:to-fuchsia-500/90" />
      <span className="text-xs text-muted-foreground">High</span>
    </div>
  );
}
