"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import StatsTable from "@/components/StatsTable";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { BarChart3, ChevronDown } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { DateRange } from "react-day-picker";
import {
  subDays,
  startOfDay,
  endOfDay,
  format,
} from "date-fns";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = {
  selectedDateRange: DateRange | undefined;
};

const baseChartOptions: ApexOptions = {
  chart: { type: "area", sparkline: { enabled: true } },
  stroke: { curve: "smooth", width: 2 },
  fill: { type: "gradient", gradient: { opacityFrom: 0.8, opacityTo: 0.1 } },
  tooltip: { enabled: false },
  yaxis: { show: false },
};

// Fallback date parser + cache in case provider rows don't have ts/parsedDate yet.
const dateCache = new Map<string, number>(); // key: dd/MM/yyyy, val: ts (local midnight)
function tsFromDDMMYYYY(ds?: string): number {
  if (!ds) return 0;
  const hit = dateCache.get(ds);
  if (hit) return hit;
  const [dd, mm, yyyy] = ds.split("/").map((x) => parseInt(x, 10));
  if (!yyyy || !mm || !dd) return 0;
  const d = new Date(yyyy, mm - 1, dd);
  const ts = d.getTime();
  dateCache.set(ds, ts);
  return ts;
}

export default function KnowbyStats({ selectedDateRange }: Props) {
  const { views, completions } = useKnowbyData();
  const [activePopup, setActivePopup] = useState<null | string>(null);

  // Normalize range to full days
  const now = new Date();
  const rawFrom = selectedDateRange?.from ?? subDays(now, 30);
  const rawTo = selectedDateRange?.to ?? now;
  const fromTs = startOfDay(rawFrom).getTime();
  const toTs = endOfDay(rawTo).getTime();

  // Filter once using numeric comparisons (prefer provider's ts if present)
  const filteredCompletions = useMemo(() => {
    return completions.filter((r: any) => {
      const ts = (r.ts as number | undefined) ?? tsFromDDMMYYYY(r?.date);
      return ts >= fromTs && ts <= toTs;
    });
  }, [completions, fromTs, toTs]);

  const filteredViews = useMemo(() => {
    return views.filter((r: any) => {
      const ts = (r.ts as number | undefined) ?? tsFromDDMMYYYY(r?.date);
      return ts >= fromTs && ts <= toTs;
    });
  }, [views, fromTs, toTs]);

  // Build trends in single passes (no per-day rescans)
  const {
    activeMembers,
    newKnowbys,
    recentlyViewed,
    unusedKnowbys,
    activeTrend,
    knowbyTrend,
    viewedTrend,
    unusedTrend,
    // Precomputed table rows (so StatsTable doesn't have to aggregate)
    activeRows,
    viewedRows,
    newKnowbysRows,
    unusedKnowbysRows,
  } = useMemo(() => {
    const trendDays = 30;
    const dayMs = 24 * 60 * 60 * 1000;
    const dailyActive = Array(trendDays).fill(0);
    const dailyViewed = Array(trendDays).fill(0);
    const memberSet = new Set<string>();
    const toDayStart = startOfDay(new Date(toTs)).getTime();
    const firstDayStart = toDayStart - (trendDays - 1) * dayMs;

    // Active members + daily active completions counts
    filteredCompletions.forEach((r: any) => {
      const ts = (r.ts as number | undefined) ?? tsFromDDMMYYYY(r?.date);
      const idx = Math.floor((ts - firstDayStart) / dayMs);
      if (idx >= 0 && idx < trendDays) dailyActive[idx] += 1;
      if (r.member_id) memberSet.add(r.member_id);
    });

    // Daily views counts
    filteredViews.forEach((r: any) => {
      const ts = (r.ts as number | undefined) ?? tsFromDDMMYYYY(r?.date);
      const idx = Math.floor((ts - firstDayStart) / dayMs);
      if (idx >= 0 && idx < trendDays) dailyViewed[idx] += 1;
    });

    // Table rows: pre-aggregate once
    // 1) Active: completions grouped by member
    const activeMap: Record<string, { member_name: string; count: number }> = {};
    filteredCompletions.forEach((d: any) => {
      const id = d.member_id ?? "(unknown)";
      if (!activeMap[id]) activeMap[id] = { member_name: d.member_name ?? "(unknown)", count: 0 };
      activeMap[id].count += 1;
    });
    const activeRows = Object.entries(activeMap)
      .map(([member_id, info]) => ({ member_id, member_name: info.member_name, count: info.count }))
      .sort((a, b) => b.count - a.count);

    // 2) Viewed: most recent view per knowby + counts
    const viewedMap: Record<string, { lastTs: number; views: number }> = {};
    filteredViews.forEach((v: any) => {
      const key = v.knowby_name ?? "(unknown)";
      const ts = (v.ts as number | undefined) ?? tsFromDDMMYYYY(v?.date);
      const cur = viewedMap[key] ?? { lastTs: 0, views: 0 };
      viewedMap[key] = { lastTs: Math.max(cur.lastTs, ts), views: cur.views + 1 };
    });
    const viewedRows = Object.entries(viewedMap)
      .map(([title, info]) => ({
        title,
        last_viewed: format(new Date(info.lastTs), "dd/MM/yyyy"),
        views: info.views,
      }))
      .sort((a, b) => {
        // sort by most recent, then by views desc
        const aTs = tsFromDDMMYYYY(a.last_viewed);
        const bTs = tsFromDDMMYYYY(b.last_viewed);
        return bTs - aTs || b.views - a.views;
      });

    // 3) New knowbys / Unused — placeholders (no creation metadata in current CSVs)
    const newKnowbysRows: any[] = [];
    const unusedKnowbysRows: any[] = [];

    return {
      activeMembers: memberSet.size,
      newKnowbys: 0,
      recentlyViewed: filteredViews.length,
      unusedKnowbys: 0,
      activeTrend: dailyActive,
      knowbyTrend: Array(trendDays).fill(0),
      viewedTrend: dailyViewed,
      unusedTrend: Array(trendDays).fill(0),
      activeRows,
      viewedRows,
      newKnowbysRows,
      unusedKnowbysRows,
    };
  }, [filteredCompletions, filteredViews, toTs]);

  const StatTile = ({
    label,
    value,
    description,
    popupId,
    popupContent,
    chartSeries,
  }: {
    label: string;
    value: number;
    description: string;
    popupId: string;
    popupContent: React.ReactNode;
    chartSeries: (number | null | number)[];
  }) => (
    <Dialog
      open={activePopup === popupId}
      onOpenChange={(open) => setActivePopup(open ? popupId : null)}
    >
      <DialogTrigger asChild>
        <div className="relative bg-muted/50 p-3 rounded-md cursor-pointer hover:bg-muted border shadow-sm flex flex-col justify-between h-[130px]">
          <ChevronDown className="absolute top-2 right-2 h-4 w-4 text-muted-foreground" />
          <div className="text-2xl font-bold">{value}</div>
          <div className="w-full h-[40px]">
            {chartSeries && chartSeries.length > 0 ? (
              <Chart
                options={baseChartOptions}
                series={[{ name: label, data: chartSeries }]}
                type="area"
                height={40}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                No data
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium">{label}</div>
            <div className="text-[10px] text-muted-foreground truncate">{description}</div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
        <h2 className="text-xl font-bold mb-2">{label}</h2>
        <DialogTitle />
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="overflow-scroll max-h-[500px]">{popupContent}</div>
      </DialogContent>
    </Dialog>
  );
  //test
  return (
    <Card className="relative isolate overflow-hidden rounded-3xl p-5 md:p-6 border-0 shadow-xl/2 bg-card dark:border dark:border-slate-700 gap-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-b from-orange-500 to-orange-700">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-lg dark:text-white font-semibold">Knowby Stats</h3>
          <span className="text-xs text-muted-foreground">
            Overview of Knowby activity and usage
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs" />
      </div>

      {/* Body */}
      <div className="mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            popupId="active"
            label="Active Members"
            value={activeMembers}
            description="Members with completions in the selected range."
            chartSeries={activeTrend}
            popupContent={
              <StatsTable
                rows={activeRows}
                type="active"
                caption="Members with completions in the selected period"
              />
            }
          />
          <StatTile
            popupId="new"
            label="New Knowbys"
            value={newKnowbys}
            description="Knowbys created in the selected range."
            chartSeries={knowbyTrend}
            popupContent={
              <StatsTable
                rows={newKnowbysRows}
                type="new"
                caption="Most recently created knowbys"
              />
            }
          />
          <StatTile
            popupId="viewed"
            label="Recently Viewed"
            value={recentlyViewed}
            description="Views in the selected range."
            chartSeries={viewedTrend}
            popupContent={
              <StatsTable
                rows={viewedRows}
                type="viewed"
                caption="Knowbys viewed in the selected period"
              />
            }
          />
          <StatTile
            popupId="unused"
            label="Unused Knowbys"
            value={unusedKnowbys}
            description="Not used in the selected range."
            chartSeries={unusedTrend}
            popupContent={
              <StatsTable
                rows={unusedKnowbysRows}
                type="unused"
                caption="Knowbys that haven’t been viewed recently"
              />
            }
          />
        </div>
      </div>
    </Card>
  );
}
