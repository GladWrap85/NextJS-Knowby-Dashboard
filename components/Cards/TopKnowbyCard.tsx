"use client";

/* ============================================================================
   IMPORTS
   ============================================================================ */

import { useEffect, useMemo, useState } from "react";
import { subDays, parse, isWithinInterval, startOfDay, endOfDay, isSameDay, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Eye, CheckCircle, TrendingUp, BookOpen, Maximize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogBtns,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";

/* ============================================================================
   TYPES
   ============================================================================ */

interface TopKnowbyCardProps {
  selectedDateRange: DateRange | undefined;
}

type AggRow = {
  knowby: string;
  views: number;
  comps: number;
  rate: number; // 0..100
};

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function TopKnowbyCard({ selectedDateRange }: TopKnowbyCardProps) {
  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */
  const { completions, views, status } = useKnowbyData();

  const [rows, setRows] = useState<AggRow[]>([]);
  const [allRows, setAllRows] = useState<AggRow[]>([]);
  const [totals, setTotals] = useState({ views: 0, comps: 0 });
  const [footerRate, setFooterRate] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  /* --------------------------------------------------------------------------
     DATE RANGE (NORMALIZED IF SINGLE DAY)
     -------------------------------------------------------------------------- */
  const endRaw = selectedDateRange?.to ?? new Date();
  const startRaw = selectedDateRange?.from ?? subDays(endRaw, 9);

  const { start, end } = useMemo(() => {
    let s = startRaw;
    let e = endRaw;
    if (isSameDay(s, e)) {
      s = startOfDay(s);
      e = endOfDay(e);
    }
    return { start: s, end: e };
  }, [startRaw, endRaw]);

  /* --------------------------------------------------------------------------
     HELPERS
     -------------------------------------------------------------------------- */
  const getName = (r: any) => (r?.knowby_name ?? r?.knowby ?? r?.title ?? r?.name)?.trim() ?? null;

  const getDateForCompletion = (r: any) => (r?.date ?? r?.completed_at ?? r?.created_at)?.trim() ?? null;
  const getDateForView = (r: any) => (r?.date ?? r?.viewed_at ?? r?.created_at)?.trim() ?? null;

  const parseFlexibleDate = (ds: string) => {
    if (!ds) return new Date(NaN);
    let d = parse(ds, "dd/MM/yyyy", new Date());
    if (!isNaN(+d)) return d;
    d = parse(ds, "MM/dd/yyyy", new Date());
    if (!isNaN(+d)) return d;
    return new Date(ds);
  };

  /* --------------------------------------------------------------------------
     EFFECT: BUILD TOP-5 + DIALOG DATA + FOOTER TOTALS
     -------------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    type Buckets = { views: number; comps: number };
    const map: Record<string, Buckets> = {};

    // completions
    for (const r of completions) {
      const name = getName(r);
      const ds = getDateForCompletion(r);
      if (!name || !ds) continue;
      const d = parseFlexibleDate(ds);
      if (!isWithinInterval(d, { start, end })) continue;
      (map[name] ??= { views: 0, comps: 0 }).comps += 1;
    }

    // views
    for (const r of views) {
      const name = getName(r);
      const ds = getDateForView(r);
      if (!name || !ds) continue;
      const d = parseFlexibleDate(ds);
      if (!isWithinInterval(d, { start, end })) continue;
      (map[name] ??= { views: 0, comps: 0 }).views += 1;
    }

    // build list + rates
    const arr: AggRow[] = Object.entries(map).map(([knowby, v]) => {
      const pct = v.views > 0 ? (v.comps / v.views) * 100 : 0;
      return { knowby, views: v.views, comps: v.comps, rate: Math.min(pct, 100) };
    });

    // sort by completions
    arr.sort((a, b) => b.comps - a.comps);
    const top5 = arr.slice(0, 5);

    // footer aggregates (top5 only)
    const total = top5.reduce(
      (acc, r) => ({ views: acc.views + r.views, comps: acc.comps + r.comps }),
      { views: 0, comps: 0 }
    );
    const fRate = total.views === 0 ? 0 : Math.min((total.comps / total.views) * 100, 100);

    if (!cancelled) {
      setAllRows(arr);
      setRows(top5);
      setTotals(total);
      setFooterRate(fRate);
    }

    return () => {
      cancelled = true;
    };
  }, [completions, views, start, end]);

  /* --------------------------------------------------------------------------
     LOADING
     -------------------------------------------------------------------------- */
  if (status === "loading") {
    return (
      <Card className="relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card">
        <div className="flex items-center gap-4">
          <div className="shrink-0 w-16 h-16 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[145px] rounded-md bg-muted animate-pulse" />
      </Card>
    );
  }

  /* --------------------------------------------------------------------------
     DERIVED TEXT
     -------------------------------------------------------------------------- */
  const caption = `Top Knowbys by completions (selected range)`;

  /* ============================================================================
     JSX
     ============================================================================ */
  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-3xl gap-3 border-0 dark:border dark:border-slate-700 shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 bg-card min-h-[365px]">
        {/* -------------------------------- HEADER -------------------------------- */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full text-white bg-gradient-to-b from-indigo-500 to-indigo-700">
            <BookOpen className="h-8 w-8" />
          </div>

          <div className="flex flex-col gap-2 w-full min-w-0">
            <div className="flex items-start">
              <h3 className="text-lg font-semibold shrink-0 dark:text-white">Top Knowbys</h3>

              <div className="ml-auto flex gap-1 flex-shrink-0">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-md hover:cursor-pointer"
                          aria-label="Expand"
                        >
                          <Maximize2 className="size-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Expand</TooltipContent>
                  </Tooltip>

                  <DialogContent className="min-w-3xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        Top Knowbys
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        {format(start, "d MMM yyyy")} – {format(end, "d MMM yyyy")} • ranked by completions
                      </DialogDescription>
                    </DialogHeader>

                    {/* Dialog table (full list) */}
                    <div className="mt-2 rounded-lg ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
                      <div className="h-1 w-full bg-indigo-500/60 dark:bg-indigo-500/50" />
                      <div className="max-h-[60vh] overflow-auto bg-white/60 dark:bg-black/10">
                        <table className="w-full text-[11.5px]">
                          <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm dark:bg-black/30 border-b border-slate-200/70 dark:border-white/10">
                            <tr className="text-left">
                              <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-6 pr-2">Rank</th>
                              <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-2 pr-2">Knowby</th>
                              <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-2 pr-2 text-right">
                                Views
                              </th>
                              <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-2 pr-6 text-right">
                                Completion rate
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {allRows.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                                  No activity in the selected window.
                                </td>
                              </tr>
                            ) : (
                              allRows.map((r, idx) => {
                                const rowBg =
                                  idx % 2 === 0
                                    ? "bg-white/80 dark:bg-slate-800/70"
                                    : "bg-slate-50/80 dark:bg-slate-900/50";
                                return (
                                  <tr
                                    key={r.knowby + idx}
                                    className={`${rowBg} hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors`}
                                  >
                                    <td className="py-1 pl-6 pr-2">
                                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted dark:bg-background text-[10px] font-semibold">
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td className="py-1 pl-2 pr-2">
                                      <span
                                        className="inline-block truncate max-w-[44ch] text-slate-700 dark:text-slate-200"
                                        title={r.knowby}
                                      >
                                        {r.knowby}
                                      </span>
                                    </td>
                                    <td className="py-1 pl-2 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                      {r.views.toLocaleString()}
                                    </td>
                                    <td className="py-1 pl-2 pr-6 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                      {`${Math.round(r.rate)}%`}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <DialogBtns className="justify-between sm:justify-end">
                      <div className="text-[11px] text-muted-foreground mr-auto">
                        {allRows.length.toLocaleString()} row{allRows.length === 1 ? "" : "s"}
                      </div>
                      <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                        Close
                      </Button>
                    </DialogBtns>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">{caption}</div>
          </div>
        </div>

        {/* -------------------------------- TABLE -------------------------------- */}
        <CardContent className="h-full rounded-2xl ring-1 ring-black/10 dark:ring-white/10 pt-0 px-0 overflow-hidden dark:bg-black/10">
          <div className="h-1 w-full bg-indigo-500/60 dark:bg-indigo-500/50" />
          <div className="overflow-hidden">
            <table className="w-full text-[12px] table-fixed">
              <colgroup>
                <col />
                <col className="w-[4.75rem] 2xl:w-[8.5rem]" />
              </colgroup>

              <thead className="bg-white/80 dark:bg-black/30">
                <tr className="border-b border-slate-200/70 dark:border-white/10 text-left">
                  <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-6 pr-2">Knowby</th>
                  <th className="font-bold text-slate-700 dark:text-slate-100 py-2 pl-2 pr-6 text-right whitespace-nowrap">
                    <span className="2xl:hidden">Rate</span>
                    <span className="hidden 2xl:inline truncate">Completion rate</span>
                  </th>
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
                  rows.map((r, idx) => {
                    const rowBg =
                      idx % 2 === 0
                        ? "bg-white/80 dark:bg-slate-800/70"
                        : "bg-slate-50/80 dark:bg-slate-900/50";
                    return (
                      <tr
                        key={r.knowby + idx}
                        className={`${rowBg} hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors`}
                      >
                        <td className="py-1 pl-6 pr-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted dark:bg-background text-[10px] font-semibold">
                              {idx + 1}
                            </span>
                            <span className="truncate text-slate-700 dark:text-slate-200 max-w-[26ch] 2xl:max-w-[44ch]">
                              {r.knowby}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pl-2 pr-6 text-right tabular-nums whitespace-nowrap">{`${Math.round(
                          r.rate
                        )}%`}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>

        {/* -------------------------------- FOOTER -------------------------------- */}
        <div className="pl-6 pr-6">
          <CardFooter className="flex items-center justify-between text-muted-foreground text-xs px-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <strong className="text-foreground">{totals.views}</strong> views
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Total views (selected range) across top 5</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{totals.comps}</strong> completions
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Total completions (selected range) across top 5</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <strong className="text-foreground">
                    {footerRate == null ? "--%" : `${footerRate.toFixed(2)}%`}
                  </strong>{" "}
                  avg rate
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Avg completion rate (selected range) across top 5</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
