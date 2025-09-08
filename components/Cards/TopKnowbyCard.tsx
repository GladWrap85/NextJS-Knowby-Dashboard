"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subDays,
  parse,
  isWithinInterval,
  startOfDay,
  endOfDay,
  isSameDay,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Eye, CheckCircle, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";

interface TopKnowbyCardProps {
  selectedDateRange: DateRange | undefined;
}

type AggRow = {
  knowby: string;
  views: number;   // event count
  comps: number;   // event count
  rate: number;    // 0..100 (events only)
};

export default function TopKnowbyCard({ selectedDateRange }: TopKnowbyCardProps) {
  const { completions, views, status } = useKnowbyData();

  // -------- Time window (normalize "daily" to full day) --------
  const endRaw = selectedDateRange?.to ?? new Date();
  const startRaw = selectedDateRange?.from ?? subDays(endRaw, 9);

  const { start, end } = useMemo(() => {
    let s = startRaw, e = endRaw;
    if (isSameDay(s, e)) {
      s = startOfDay(s);
      e = endOfDay(e);
    }
    return { start: s, end: e };
  }, [startRaw, endRaw]);

  const [rows, setRows] = useState<AggRow[]>([]);
  const [totals, setTotals] = useState({ views: 0, comps: 0 });
  const [footerRate, setFooterRate] = useState<number | null>(null);

  // ----- Helpers: tolerant getters + flexible date parse -----
  const getName = (r: any) =>
    (r?.knowby_name ?? r?.knowby ?? r?.title ?? r?.name)?.trim() ?? null;

  // completions may come with date | completed_at | created_at
  const getDateForCompletion = (r: any) =>
    (r?.date ?? r?.completed_at ?? r?.created_at)?.trim() ?? null;

  // views may come with date | viewed_at | created_at
  const getDateForView = (r: any) =>
    (r?.date ?? r?.viewed_at ?? r?.created_at)?.trim() ?? null;

  const parseFlexibleDate = (ds: string) => {
    if (!ds) return new Date(NaN);
    let d = parse(ds, "dd/MM/yyyy", new Date());
    if (!isNaN(+d)) return d;
    d = parse(ds, "MM/dd/yyyy", new Date());
    if (!isNaN(+d)) return d;
    return new Date(ds); // ISO or other
  };

  useEffect(() => {
    let cancelled = false;

    type Buckets = { views: number; comps: number };
    const map: Record<string, Buckets> = {};

    // ---- ingest completions (events) ----
    for (const r of completions) {
      const name = getName(r);
      const ds = getDateForCompletion(r);
      if (!name || !ds) continue;
      const d = parseFlexibleDate(ds);
      if (!isWithinInterval(d, { start, end })) continue;

      (map[name] ??= { views: 0, comps: 0 }).comps += 1;
    }

    // ---- ingest views (events) ----
    for (const r of views) {
      const name = getName(r);
      const ds = getDateForView(r);
      if (!name || !ds) continue;
      const d = parseFlexibleDate(ds);
      if (!isWithinInterval(d, { start, end })) continue;

      (map[name] ??= { views: 0, comps: 0 }).views += 1;
    }

    // ---- build rows: event-based rate ----
    const arr: AggRow[] = Object.entries(map).map(([knowby, v]) => {
      const pct = v.views > 0 ? (v.comps / v.views) * 100 : 0;
      return { knowby, views: v.views, comps: v.comps, rate: Math.min(pct, 100) };
    });

    // rank by completions, top 5
    arr.sort((a, b) => b.comps - a.comps);
    const top5 = arr.slice(0, 5);

    // footer totals + footer rate (events only, clamped, 0% if no views)
    const total = top5.reduce(
      (acc, r) => ({ views: acc.views + r.views, comps: acc.comps + r.comps }),
      { views: 0, comps: 0 }
    );
    const fRate =
      total.views === 0 ? 0 : Math.min((total.comps / total.views) * 100, 100);

    if (!cancelled) {
      setRows(top5);
      setTotals(total);
      setFooterRate(fRate);
    }
    return () => {
      cancelled = true;
    };
  }, [completions, views, start, end]);

  // Loading skeleton (first load only)
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

  const caption = `Top Knowbys by completions (selected range)`;

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3 border-none shadow-none">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-lg text-white bg-gradient-to-b from-blue-500 to-blue-700">
            <TrendingUp className="h-8 w-8" />
          </div>
          <div className="flex flex-col gap-2 w-full min-w-0">
            <div className="flex items-start">
              <h3 className="text-lg font-semibold shrink-0">Top Knowbys</h3>
              <div className="ml-auto flex gap-1 flex-shrink-0">{/* no per-card tabs */}</div>
            </div>
            <div className="text-xs text-muted-foreground">{caption}</div>
          </div>
        </div>

        <hr className="border-border" />

        {/* ======= TABLE ======= */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-semibold">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left text-xs py-2 pl-6">Knowby</th>
                  <th className="text-right text-xs py-2 pr-6">Completion rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-muted-foreground">
                      No activity in the selected window.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr
                      key={r.knowby + idx}
                      className={idx % 2 ? "bg-muted/30" : "bg-transparent"}
                    >
                      <td className="py-2 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                            {idx + 1}
                          </span>
                          <span className="inline-block truncate max-w-[24ch]" title={r.knowby}>
                            {r.knowby}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-6 text-right tabular-nums">
                        {`${Math.round(r.rate)}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>

        {/* Footer summary */}
        <div className="pl-6 pr-6">
          <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{totals.views}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent> Total Views (selected range) across top 5 </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>{totals.comps}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent> Total Completions (selected range) across top 5 </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  <span>{footerRate == null ? "--%" : `${footerRate.toFixed(2)}%`}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent> Avg completion rate (selected range) across top 5 </TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
