"use client";

/* ============================================================================
   IMPORTS
   ============================================================================ */

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BarChart3, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

/* ============================================================================
   TYPES & CONSTANTS
   ============================================================================ */

type MetricKey = "activeMembers" | "recentlyViewed" | "newKnowbys" | "unusedKnowbys";

const METRICS: Array<{
  key: MetricKey;
  label: string;
  hint: string;
  color: string;
}> = [
    { key: "activeMembers", label: "Active Members", hint: "Members with views or completions", color: "bg-sky-500" },
    { key: "recentlyViewed", label: "Recently Viewed", hint: "Views in range", color: "bg-blue-500" },
    { key: "newKnowbys", label: "New Knowbys", hint: "Created in range", color: "bg-violet-500" },
    { key: "unusedKnowbys", label: "Unused Knowbys", hint: "No views in range", color: "bg-orange-500" },
  ];

type Props = { selectedDateRange: DateRange | undefined; className?: string };

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function KnowbyStats({ selectedDateRange, className }: Props) {
  /* --------------------------------------------------------------------------
     STATE & PROVIDER DATA
     -------------------------------------------------------------------------- */
  const { completions, views, knowbys, status } = useKnowbyData();

  /* --------------------------------------------------------------------------
     DATE RANGE (RESOLVED FROM SELECTION OR DATA BOUNDS)
     -------------------------------------------------------------------------- */
  const dataBounds = useMemo(() => {
    let min = Number.POSITIVE_INFINITY, max = 0;
    for (const r of completions) if (r.ts) { if (r.ts < min) min = r.ts; if (r.ts > max) max = r.ts; }
    for (const r of views) if (r.ts) { if (r.ts < min) min = r.ts; if (r.ts > max) max = r.ts; }
    const nowish = Date.now();
    if (!isFinite(min)) min = nowish;
    if (!isFinite(max)) max = nowish;
    return { min, max };
  }, [completions, views]);

  const start = startOfDay(selectedDateRange?.from ?? new Date(dataBounds.max - 6 * 86400000));
  const end = endOfDay(selectedDateRange?.to ?? selectedDateRange?.from ?? new Date(dataBounds.max));

  const inRange = (ts?: number) =>
    typeof ts === "number" && isWithinInterval(new Date(ts), { start, end });

  /* --------------------------------------------------------------------------
     PRECOMPUTED DAY INDEX & FILTERED EVENTS
     -------------------------------------------------------------------------- */
  const days = useMemo(
    () => eachDayOfInterval({ start, end }).map((d) => startOfDay(d).getTime()),
    [start, end]
  );

  const viewsIn = useMemo(() => views.filter((r) => inRange(r.ts)), [views, start, end]);
  const compsIn = useMemo(() => completions.filter((r) => inRange(r.ts)), [completions, start, end]);

  /* --------------------------------------------------------------------------
     SHARED AGGREGATES (TOTALS, TABLES, SPARKLINES)
     -------------------------------------------------------------------------- */
  const shared = useMemo(() => {
    // Catalog from provider if available; else infer from events
    const catalog =
      knowbys?.length
        ? knowbys
        : Array.from(
          new Map(
            [...completions, ...views]
              .filter((r) => r.knowby_id)
              .map((r) => [r.knowby_id!, { knowby_id: r.knowby_id!, knowby_name: r.knowby_name }])
          ).values()
        );

    const catalogIds = new Set(catalog.map((k) => k.knowby_id));

    // Seen-in-range (views)
    const seenNow = new Set<string>();
    for (const r of viewsIn) if (r.knowby_id) seenNow.add(r.knowby_id);

    // Active members (views OR completions)
    const activeMemberSet = new Set<string>();
    for (const r of viewsIn) if (r.member_id) activeMemberSet.add(r.member_id);
    for (const r of compsIn) if (r.member_id) activeMemberSet.add(r.member_id);

    // Members per day (unique by completions)
    const membersPerDay = (() => {
      const m = new Map<number, Set<string>>();
      for (const d of days) m.set(d, new Set());
      for (const r of compsIn) {
        if (!r.ts || !r.member_id) continue;
        const d = startOfDay(new Date(r.ts)).getTime();
        if (m.has(d)) m.get(d)!.add(r.member_id);
      }
      return days.map((d) => ({ x: d, y: m.get(d)!.size }));
    })();

    // Views per day
    const viewsCountPerDay = (() => {
      const m = new Map<number, number>();
      for (const d of days) m.set(d, 0);
      for (const r of viewsIn) {
        if (!r.ts) continue;
        const d = startOfDay(new Date(r.ts)).getTime();
        if (m.has(d)) m.set(d, (m.get(d) || 0) + 1);
      }
      return days.map((d) => ({ x: d, y: m.get(d)! }));
    })();

    // New Knowbys per day (creation-based)
    const newKnowbysPerDay = (() => {
      const m = new Map<number, number>();
      for (const d of days) m.set(d, 0);
      for (const k of knowbys ?? []) {
        const ts = (k as any).createdTs as number | undefined;
        if (typeof ts !== "number") continue;
        const d = startOfDay(new Date(ts)).getTime();
        if (d >= days[0] && d <= days[days.length - 1] && m.has(d)) {
          m.set(d, (m.get(d) || 0) + 1);
        }
      }
      return days.map((d) => ({ x: d, y: m.get(d)! }));
    })();

    // Unused knowbys per day (catalog not yet viewed by that day)
    const unusedPerDay = (() => {
      const usedUntil = new Set<string>();
      const sortedViews = [...views].filter((v) => v.ts && v.knowby_id).sort((a, b) => a.ts! - b.ts!);
      let i = 0;
      return days.map((d) => {
        while (i < sortedViews.length && startOfDay(new Date(sortedViews[i].ts!)).getTime() <= d) {
          usedUntil.add(sortedViews[i].knowby_id!);
          i++;
        }
        const unused = catalogIds.size - usedUntil.size;
        return { x: d, y: Math.max(unused, 0) };
      });
    })();

    // Totals
    const createdInRange = (knowbys ?? []).filter((k) => inRange((k as any).createdTs));
    const totals = {
      activeMembers: activeMemberSet.size,
      recentlyViewed: viewsIn.length,
      newKnowbys: createdInRange.length,
      unusedKnowbys: [...catalogIds].filter((id) => !seenNow.has(id)).length,
    } as Record<MetricKey, number>;

    // Tables
    const tables = (() => {
      // Active members table
      const activeMap = new Map<
        string,
        { member: string; views: number; completions: number; last: number }
      >();

      for (const r of viewsIn) {
        const id = r.member_id ?? r.member_name ?? "unknown";
        const name = r.member_name ?? "-";
        const prev = activeMap.get(id) ?? { member: name, views: 0, completions: 0, last: 0 };
        prev.member = name || prev.member;
        prev.views += 1;
        prev.last = Math.max(prev.last, r.ts || 0);
        activeMap.set(id, prev);
      }
      for (const r of compsIn) {
        const id = r.member_id ?? r.member_name ?? "unknown";
        const name = r.member_name ?? "-";
        const prev = activeMap.get(id) ?? { member: name, views: 0, completions: 0, last: 0 };
        prev.member = name || prev.member;
        prev.completions += 1;
        prev.last = Math.max(prev.last, r.ts || 0);
        activeMap.set(id, prev);
      }

      const active = [...activeMap.values()]
        .sort((a, b) => b.completions - a.completions || b.views - a.views || b.last - a.last)
        .map((r) => ({
          member: r.member,
          views: r.views,
          completions: r.completions,
          last: r.last ? format(r.last, "d MMM") : "-",
        }));

      // Recently viewed (latest 30)
      const recentV = viewsIn
        .slice(-30)
        .reverse()
        .map((r) => ({
          date: r.ymd ?? (r.ts ? format(r.ts, "d MMM") : "-"),
          knowby: r.knowby_name ?? r.knowby_id ?? "-",
          member: r.member_name ?? r.member_id ?? "-",
        }));

      // New knowbys (in range)
      const newK = createdInRange
        .sort((a, b) => (a as any).createdTs! - (b as any).createdTs!)
        .slice(0, 200)
        .map((k) => ({
          knowby: (k as any).knowby_name ?? (k as any).knowby_id,
          knowby_id: (k as any).knowby_id,
          created: (k as any).createdTs ? format((k as any).createdTs, "d MMM") : "-",
        }));

      // Unused knowbys (no views in-range)
      const unused = [...catalogIds]
        .filter((id) => !seenNow.has(id))
        .map((id) => {
          const knowby = catalog.find((k) => k.knowby_id === id);
          const lastView = [...views, ...completions]
            .filter((r) => r.knowby_id === id && r.ts)
            .reduce((max, r) => Math.max(max, r.ts!), 0);
          return { knowby: knowby?.knowby_name ?? id, last_used: lastView ? format(lastView, "d MMM yy") : "–" };
        })
        .sort((a, b) => (b.last_used === "–" ? -1 : a.last_used === "–" ? 1 : 0))
        .slice(0, 200);

      return {
        activeMembers: active,
        recentlyViewed: recentV,
        newKnowbys: newK,
        unusedKnowbys: unused,
      } as Record<MetricKey, any[]>;
    })();

    // Sparklines (for header)
    const sparklines = {
      activeMembers: membersPerDay,
      recentlyViewed: viewsCountPerDay,
      newKnowbys: newKnowbysPerDay,
      unusedKnowbys: unusedPerDay,
    } as Record<MetricKey, Array<{ x: number; y: number }>>;

    return { totals, tables, sparklines };
  }, [days, completions, views, knowbys, compsIn, viewsIn, inRange]);

  /* --------------------------------------------------------------------------
     UI STATE (ACTIVE METRIC, DIALOG, PAGINATION)
     -------------------------------------------------------------------------- */
  const [activeMetric, setActiveMetric] = useState<MetricKey>("activeMembers");
  const [dialogOpen, setDialogOpen] = useState(false);

  const PAGE_SIZE = 4;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [activeMetric]);

  const headerSeries = shared.sparklines[activeMetric] ?? [];
  const activeMeta = METRICS.find((m) => m.key === activeMetric)!;

  const allRows = shared.tables[activeMetric] ?? [];
  const total = allRows.length;
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageRows = allRows.slice(startIdx, endIdx);

  /* ============================================================================
     SKELETON (LOADING) & RENDER
     ============================================================================ */
  if (status === "loading") {
    return (
      <Card className="relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-36 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-3 w-48 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-8 w-40 rounded-md bg-muted animate-pulse" />
            <div className="h-8 w-[120px] rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "min-h-[350px] relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card",
          "dark:border dark:border-slate-700",
          className
        )}
      >
        <CardContent className="p-0 h-full flex flex-col gap-2">
          {/* -------------------------------- HEADER -------------------------------- */}
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-b from-orange-500 to-orange-700">
              <BarChart3 className="h-5 w-5" />
            </div>

            <div className="flex flex-col min-w-0">
              <h3 className="text-base md:text-lg dark:text-white font-semibold">Knowby Stats</h3>
              <span className="text-xs text-muted-foreground">
                {format(start, "d MMM yyyy")} – {format(end, "d MMM yyyy")}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Metric select */}
              <div className="hidden sm:block">
                <Select value={activeMetric} onValueChange={(v: MetricKey) => setActiveMetric(v)}>
                  <SelectTrigger
                    className={cn(
                      "data-[size=default]:h-8 w-48 rounded-lg text-xs border-0 hover:cursor-pointer",
                      "ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-black/10"
                    )}
                    aria-label="Select metric"
                  >
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent align="end" className="text-sm">
                    {METRICS.map((m) => (
                      <SelectItem key={m.key} value={m.key} className="text-xs hover:cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-block h-2 w-2 rounded-full", m.color)} />
                          <span className="font-medium">{m.label}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                            {(shared.totals[m.key] ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Header sparkline */}
              <div
                className="hidden sm:flex items-center rounded-lg pl-2 pr-2 py-0 ring-1 h-8 bg-white/60 text-slate-700 ring-black/10 dark:bg-black/10 dark:text-slate-200 dark:ring-white/10"
                title="Activity trend for selected metric"
              >
                <div className="h-[24px] w-[100px] -my-[2px]">
                  <SparklineMini data={headerSeries} height={24} />
                </div>
              </div>

              {/* Expand dialog */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md hover:cursor-pointer" aria-label="Expand">
                        <Maximize2 className="size-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Expand</TooltipContent>
                </Tooltip>

                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", activeMeta.color)} />
                      {activeMeta.label}
                    </DialogTitle>
                    <DialogDescription className="flex items-center justify-between">
                      <span className="text-xs">
                        {format(start, "d MMM yyyy")} – {format(end, "d MMM yyyy")} • {activeMeta.hint}
                      </span>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-2 rounded-lg ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
                    <div className={cn("h-1 w-full", activeMeta.color)} />
                    <div className="max-h-[60vh] overflow-auto bg-white/60 dark:bg-black/10">
                      <MiniTable rows={allRows} />
                    </div>
                  </div>

                  <DialogFooter className="justify-between sm:justify-end">
                    <div className="text-[11px] text-muted-foreground mr-auto">
                      {total.toLocaleString()} row{total === 1 ? "" : "s"}
                    </div>
                    <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* -------------------------------- CONTENT -------------------------------- */}
          <div className={cn("flex-1 min-h-0 rounded-2xl ring-1 ring-black/10 dark:ring-white/10", "dark:bg-black/10 p-3")}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">{activeMeta.label}</div>
              <div className="text-[11px] text-muted-foreground">{activeMeta.hint}</div>
            </div>

            <div className="h-[200px] rounded-2xl ring-1 ring-black/10 dark:ring-white/10 pt-0 px-0 bg-white/60 dark:bg-black/10 overflow-hidden">
              <div className={cn("h-1 w-full", activeMeta.color)} />
              <MiniTable rows={pageRows} />
              <div className="flex items-center justify-between px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  {total === 0 ? "0 results" : `Showing ${startIdx + 1}–${endIdx} of ${total}`}
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
                    onClick={() => setPage((p) => (endIdx < total ? p + 1 : p))}
                    disabled={endIdx >= total}
                  >
                    <span className="mr-1 text-xs hover:cursor-pointer">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

/* ============================================================================
   HELPER COMPONENTS
   ============================================================================ */

/* -- Tiny sparkline (fits header height) -- */
function SparklineMini({
  data,
  height = 22,
}: {
  data: Array<{ x: number; y: number }>;
  height?: number;
}) {
  const series = useMemo(() => [{ name: "t", data }], [data]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "line",
        height,
        sparkline: { enabled: true },
        animations: { enabled: false },
        toolbar: { show: false },
        zoom: { enabled: false },
        parentHeightOffset: 0,
      },
      stroke: { width: 2, curve: "smooth" },
      xaxis: {
        type: "datetime",
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false },
      },
      yaxis: { show: false },
      grid: { show: false },
      tooltip: { enabled: false },
    }),
    [height]
  );

  return <Chart type="line" height={height} options={options} series={series} />;
}

/* -- Compact table -- */
function MiniTable({ rows }: { rows: any[] }) {
  if (!rows?.length) {
    return (
      <div className="h-[120px] grid place-items-center text-xs text-muted-foreground">
        No rows in this range.
      </div>
    );
  }

  const keys = Object.keys(rows[0]);
  const pref = ["member", "views", "completions", "last", "date", "knowby", "knowby_id", "created", "first"];
  const cols = [
    ...pref.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !pref.includes(k) && k !== "id" && k !== "member_id"),
  ];

  return (
    <table className="w-full text-[12px]">
      <thead className="sticky top-0 z-10 bg-white/90 dark:bg-black/30 border-b border-slate-200/70 dark:border-white/10">
        <tr className="[&>th]:py-2 [&>th]:px-3 text-left">
          {cols.map((h) => (
            <th key={h} className="font-bold text-slate-700 dark:text-slate-100">
              {h.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            className={cn(
              "[&>td]:py-1.5 [&>td]:px-3",
              i % 2 === 0 ? "bg-white/80 dark:bg-slate-800/70" : "bg-slate-50/80 dark:bg-slate-900/50",
              "hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
            )}
          >
            {cols.map((h) => (
              <td
                key={h}
                className="whitespace-nowrap max-w-[28ch] truncate text-slate-700 dark:text-slate-200"
                title={String(r[h] ?? "")}
              >
                {typeof r[h] === "number" ? (r[h] as number).toLocaleString() : String(r[h] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
