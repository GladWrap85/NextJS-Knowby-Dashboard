// components/Cards/KnowbyStatsMiniCardCompact.tsx
"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  format, isWithinInterval,
  startOfDay, endOfDay, eachDayOfInterval
} from "date-fns";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Download } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type MetricKey = "activeMembers" | "recentlyViewed" | "newKnowbys" | "unusedKnowbys";

const METRICS: Array<{ key: MetricKey; label: string; hint: string; color: string }> = [
  { key: "activeMembers",  label: "Active Members",  hint: "Members with views or completions",  color: "bg-sky-500" },
  { key: "recentlyViewed", label: "Recently Viewed", hint: "Views in range",                      color: "bg-blue-500" },
  { key: "newKnowbys",     label: "New Knowbys",     hint: "First-seen in range*",                color: "bg-violet-500" },
  { key: "unusedKnowbys",  label: "Unused Knowbys",  hint: "0 views in range",                    color: "bg-orange-500" },
];

type Props = { selectedDateRange: DateRange | undefined; className?: string };

export default function KnowbyStats({ selectedDateRange, className }: Props) {
  const { completions, views } = useKnowbyData();

  // —— resolve effective range (fallback = last 7 days at data max)
  const dataBounds = useMemo(() => {
    let min = Number.POSITIVE_INFINITY, max = 0;
    for (const r of completions) if (r.ts) { if (r.ts < min) min = r.ts; if (r.ts > max) max = r.ts; }
    for (const r of views)        if (r.ts) { if (r.ts < min) min = r.ts; if (r.ts > max) max = r.ts; }
    const nowish = Date.now();
    if (!isFinite(min)) min = nowish;
    if (!isFinite(max)) max = nowish;
    return { min, max };
  }, [completions, views]);

  const start = startOfDay(selectedDateRange?.from ?? new Date(dataBounds.max - 6 * 86400000));
  const end   = endOfDay(selectedDateRange?.to ?? selectedDateRange?.from ?? new Date(dataBounds.max));
  const inRange = (ts?: number) => typeof ts === "number" && isWithinInterval(new Date(ts), { start, end });

  // —— precompute shared structures once
  const days = useMemo(
    () => eachDayOfInterval({ start, end }).map(d => startOfDay(d).getTime()),
    [start, end]
  );

  const viewsIn = useMemo(() => views.filter(r => inRange(r.ts)), [views, start, end]);
  const compsIn = useMemo(() => completions.filter(r => inRange(r.ts)), [completions, start, end]);

  const shared = useMemo(() => {
    // Active members = union of members with views OR completions in-range
    const activeMemberSet = new Set<string>();
    for (const r of viewsIn) if (r.member_id) activeMemberSet.add(r.member_id);
    for (const r of compsIn) if (r.member_id) activeMemberSet.add(r.member_id);

    // First-seen per knowby across entire dataset
    const firstSeenByKnowby = new Map<string, number>();
    const pushFirst = (id?: string, ts?: number) => {
      if (!id || !ts) return;
      const cur = firstSeenByKnowby.get(id);
      if (cur == null || ts < cur) firstSeenByKnowby.set(id, ts);
    };
    for (const r of completions) pushFirst(r.knowby_id, r.ts);
    for (const r of views)       pushFirst(r.knowby_id, r.ts);

    // All knowby ids, and which were seen in-range (via views)
    const allKnowbys = new Set<string>();
    for (const r of completions) if (r.knowby_id) allKnowbys.add(r.knowby_id);
    for (const r of views)       if (r.knowby_id) allKnowbys.add(r.knowby_id);

    const seenNow = new Set<string>();
    for (const r of viewsIn) if (r.knowby_id) seenNow.add(r.knowby_id);

    // helpers
    const initNumMap = () => {
      const m = new Map<number, number>();
      for (const d of days) m.set(d, 0);
      return m;
    };

    // Members per day (unique count) — based on completions to keep existing meaning
    const membersPerDay = (() => {
      const m = new Map<number, Set<string>>();
      for (const d of days) m.set(d, new Set());
      for (const r of compsIn) {
        if (!r.ts || !r.member_id) continue;
        const d = startOfDay(new Date(r.ts)).getTime();
        if (m.has(d)) m.get(d)!.add(r.member_id);
      }
      return days.map(d => ({ x: d, y: m.get(d)!.size }));
    })();

    // Views per day
    const viewsCountPerDay = (() => {
      const m = initNumMap();
      for (const r of viewsIn) {
        if (!r.ts) continue;
        const d = startOfDay(new Date(r.ts)).getTime();
        if (m.has(d)) m.set(d, (m.get(d) || 0) + 1);
      }
      return days.map(d => ({ x: d, y: m.get(d)! }));
    })();

    // First-seen per day (counts)
    const firstSeenPerDay = (() => {
      const m = initNumMap();
      for (const ts of firstSeenByKnowby.values()) {
        const d = startOfDay(new Date(ts)).getTime();
        if (d >= days[0] && d <= days[days.length - 1] && m.has(d)) {
          m.set(d, (m.get(d) || 0) + 1);
        }
      }
      return days.map(d => ({ x: d, y: m.get(d)! }));
    })();

    // Unused knowbys per day (cumulative "not yet viewed by that day")
    const unusedPerDay = (() => {
      const usedUntil = new Set<string>();
      const sortedViews = [...views]
        .filter(v => v.ts && v.knowby_id)
        .sort((a, b) => (a.ts! - b.ts!));
      let i = 0;
      const all = [...allKnowbys];
      return days.map(d => {
        while (i < sortedViews.length && startOfDay(new Date(sortedViews[i].ts!)).getTime() <= d) {
          usedUntil.add(sortedViews[i].knowby_id!);
          i++;
        }
        const unused = all.length - usedUntil.size;
        return { x: d, y: unused < 0 ? 0 : unused };
      });
    })();

    // FIX: totals.activeMembers uses the union set
    const totals = {
      activeMembers: activeMemberSet.size,
      recentlyViewed: viewsIn.length,
      newKnowbys: [...firstSeenByKnowby.values()].filter(ts => inRange(ts)).length,
      unusedKnowbys: [...allKnowbys].filter(k => !seenNow.has(k)).length,
    } as Record<MetricKey, number>;

    // Tables (compact)
    const tables = (() => {
      // FIXED: Active members table built from union; includes views & completions and shows ALL members (no slice)
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
        .sort((a, b) => (b.completions - a.completions) || (b.views - a.views) || (b.last - a.last))
        .map(r => ({
          member: r.member,
          views: r.views,
          completions: r.completions,
          last: r.last ? format(r.last, "d MMM") : "-"
        }));

      // Recently viewed: latest 30 view events in range
      const recentV = viewsIn
        .slice(-30)
        .reverse()
        .map(r => ({
          date: r.ymd ?? (r.ts ? format(r.ts, "d MMM") : "-"),
          knowby: r.knowby_name ?? r.knowby_id ?? "-",
          member: r.member_name ?? r.member_id ?? "-",
        }));

      // New knowbys (first-seen in range)
      const newK = [...firstSeenByKnowby.entries()]
        .filter(([_, ts]) => inRange(ts))
        .sort((a, b) => a[1] - b[1])
        .slice(0, 25)
        .map(([id, ts]) => ({ knowby_id: id, first: format(ts, "d MMM") }));

      // Unused knowbys (no views in range)
      const unused = [...allKnowbys]
        .filter(k => !seenNow.has(k))
        .slice(0, 40)
        .map(k => ({ knowby_id: k }));

      return {
        activeMembers: active,
        recentlyViewed: recentV,
        newKnowbys: newK,
        unusedKnowbys: unused,
      } as Record<MetricKey, any[]>;
    })();

    // Sparklines
    const sparklines = {
      activeMembers: membersPerDay,
      recentlyViewed: viewsCountPerDay,
      newKnowbys: firstSeenPerDay,
      unusedKnowbys: unusedPerDay,
    } as Record<MetricKey, Array<{ x: number; y: number }>>;

    return { totals, tables, sparklines };
  }, [days, completions, views, compsIn, viewsIn, inRange]);

  // —— ui state
  const [activeTab, setActiveTab] = useState<MetricKey>("activeMembers");

  const exportCSV = () => {
    const rows = shared.tables[activeTab] || [];
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${activeTab}-${format(new Date(),"yyyyMMdd-HHmm")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // current sparkline data for header pill
  const headerSeries = shared.sparklines[activeTab] ?? [];

  return (
    <TooltipProvider>
      <Card className={cn(
        "min-h-[300px] relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card",
        "dark:border dark:border-slate-700",
        className
      )}>
        <CardContent className="p-0 h-full flex flex-col">
          {/* Header — icon, title, date, sparkline pill, export */}
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

            {/* sparkline pill */}
            <div className="ml-auto flex items-center">
              <div
                className=
                  "hidden sm:flex mr-10 items-center rounded-lg pl-3 pr-2 py-1 ring-1 bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:ring-white/10"
                title="Activity trend for selected metric"
              >
                <div className="h-[22px] w-[140px]">
                  <SparklineMini data={headerSeries} />
                </div>
              </div>

              {/* export */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md" onClick={exportCSV} aria-label="Export CSV">
                    <Download className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Export visible table</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Tabs → one metric at a time */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as MetricKey)}
            className={cn("mt-3 flex-1 min-h-0")}
          >
            <TabsList className="grid grid-cols-4 w-full gap-0 bg-background">
              {METRICS.map(m => (
                <TabsTrigger key={m.key} value={m.key} className="flex items-center justify-between gap-2 data-[state=active]:bg-white">
                  <span className="text-xs font-medium">{m.label}</span>
                  <Badge variant="secondary" className="rounded-full text-[9px] tabular-nums">
                    {(shared.totals[m.key] ?? 0).toLocaleString()}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {METRICS.map(m => {
              const rows = shared.tables[m.key];
              return (
                <TabsContent
                  key={m.key}
                  value={m.key}
                  className="mt-3 flex flex-col min-h-0 flex-1"
                >
                  {/* Table title */}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                  </div>

                  {/* Table */}
                  <div className={cn("mt-2 min-h-0 flex-1 overflow-hidden rounded-lg ring-1 ring-black/10 dark:ring-white/10")}>
                    <div className={cn("h-1 w-full", m.color)} />
                    <div className="h-[160px] overflow-auto bg-white/60 dark:bg-black/10">
                      <MiniTable rows={rows} />
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

/* ——— ultra-compact sparkline for header pill ——— */
function SparklineMini({ data }: { data: Array<{ x:number; y:number }> }) {
  const series = useMemo(() => [{ name: "t", data }], [data]);
  const dark =
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
      : false;

  const options = useMemo<ApexOptions>(() => ({
    chart: {
      type: "line",
      height: 22,
      sparkline: { enabled: true },
      animations: { enabled: false },
      toolbar: { show: false },
      zoom: { enabled: false },
      parentHeightOffset: 0,
    },
    stroke: { width: 2, curve: "smooth" },
    xaxis: { type: "datetime", labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
    yaxis: { show: false },
    grid: { show: false },
    tooltip: { enabled: false },
  }), [dark]);

  return <Chart type="line" height={22} options={options} series={series} />;
}

/* ——— ultra-compact table ——— */
/* ——— compact table with white header + alternating rows ——— */
function MiniTable({ rows }: { rows: any[] }) {
  if (!rows?.length) {
    return (
      <div className="h-full grid place-items-center text-xs text-muted-foreground">
        No rows in this range.
      </div>
    );
  }

  const keys = Object.keys(rows[0]);

  // preferred column order
  const pref = ["member", "views", "completions", "last", "date", "knowby", "knowby_id", "first"];
  const cols = [
    ...pref.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !pref.includes(k) && k !== "id" && k !== "member_id"),
  ];

  return (
    <table className="w-full text-[11px]">
      {/* white sticky header */}
      <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
        <tr className="[&>th]:py-2 [&>th]:px-3 text-left border-b border-slate-200 dark:border-white/10">
          {cols.map((h) => (
            <th key={h} className="font-medium text-slate-700 dark:text-slate-300">
              {h.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
            </th>
          ))}
        </tr>
      </thead>

      {/* alternating row colors */}
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            className={cn(
              "[&>td]:py-2 [&>td]:px-3",
              i % 2 === 0
                ? "bg-white dark:bg-slate-800"
                : "bg-slate-50 dark:bg-slate-900/60",
              "hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
            )}
          >
            {cols.map((h) => (
              <td
                key={h}
                className="whitespace-nowrap max-w-[22ch] truncate text-slate-700 dark:text-slate-200"
                title={String(r[h] ?? "")}
              >
                {typeof r[h] === "number"
                  ? (r[h] as number).toLocaleString()
                  : String(r[h] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}