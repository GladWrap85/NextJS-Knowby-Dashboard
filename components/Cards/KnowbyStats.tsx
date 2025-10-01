"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import StatsTable from "@/components/Cards/StatsTable";
import StatsPopupGraph from "@/components/Cards/StatsPopupGraph";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { ChevronDown } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { DateRange } from "react-day-picker";
import {
  parse,
  isWithinInterval,
  subDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { KnowbyMeta } from "@/src/types/knowby";
import { format } from "date-fns"; // add to imports

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = { selectedDateRange: DateRange | undefined };

const baseChartOptions: ApexOptions = {
  chart: { type: "area", sparkline: { enabled: true } },
  stroke: { curve: "smooth", width: 2 },
  fill: { type: "gradient", gradient: { opacityFrom: 0.8, opacityTo: 0.1 } },
  tooltip: { enabled: false },
  yaxis: { show: false },
};

function parseCsvDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

export default function KnowbyStats({ selectedDateRange }: Props) {
  const { completions, views, knowbys } = useKnowbyData();
  const [activePopup, setActivePopup] = useState<null | string>(null);

  const now = new Date();
  const rawFrom = selectedDateRange?.from ?? subDays(now, 30);
  const rawTo = selectedDateRange?.to ?? now;
  const from = startOfDay(rawFrom);
  const to = endOfDay(rawTo);

  // Filter data for selected range
  const filteredCompletions = completions.filter((r) => {
    const d = parseCsvDate(r.date);
    return d && isWithinInterval(d, { start: from, end: to });
  });
  const filteredViews = views.filter((r) => {
    const d = parseCsvDate(r.date);
    return d && isWithinInterval(d, { start: from, end: to });
  });
  const filteredKnowbys = knowbys.filter((k) => {
    const d = parseCsvDate(k.created_at);
    return d && isWithinInterval(d, { start: from, end: to });
  });

  const grouped = useMemo(() => {
    const completionsByDay = new Map<string, typeof completions>();
    const viewsByDay = new Map<string, typeof views>();
    const knowbysByDay = new Map<string, typeof knowbys>();

    completions.forEach((c) => {
      const d = parseCsvDate(c.date);
      if (d) {
        const key = format(d, "yyyy-MM-dd");
        if (!completionsByDay.has(key)) completionsByDay.set(key, []);
        completionsByDay.get(key)!.push(c);
      }
    });

    views.forEach((v) => {
      const d = parseCsvDate(v.date);
      if (d) {
        const key = format(d, "yyyy-MM-dd");
        if (!viewsByDay.has(key)) viewsByDay.set(key, []);
        viewsByDay.get(key)!.push(v);
      }
    });

    knowbys.forEach((k) => {
      const d = parseCsvDate(k.created_at);
      if (d) {
        const key = format(d, "yyyy-MM-dd");
        if (!knowbysByDay.has(key)) knowbysByDay.set(key, []);
        knowbysByDay.get(key)!.push(k);
      }
    });

    return { completionsByDay, viewsByDay, knowbysByDay };
  }, [completions, views, knowbys]);

  const {
    activeMembers,
    newKnowbys,
    recentlyViewed,
    unusedKnowbys,
    activeMembersData,
    newKnowbysData,
    recentlyViewedData,
    unusedKnowbysData,
    activeTrend,
    knowbyTrend,
    viewedTrend,
    unusedTrend,
  } = useMemo(() => {
    const memberSet = new Set<string>();

    const daysInRange =
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const activeCounts: number[] = [];
    const newCounts: number[] = [];
    const viewedCounts: number[] = [];
    const unusedCounts: number[] = [];

    for (let i = 0; i < daysInRange; i++) {
      const day = subDays(to, daysInRange - 1 - i);
      const dayKey = format(day, "yyyy-MM-dd");

      // Active members
      const dayCompletions = grouped.completionsByDay.get(dayKey) ?? [];
      activeCounts.push(new Set(dayCompletions.map((c) => c.member_id)).size);

      // New knowbys
      const dayKnowbys = grouped.knowbysByDay.get(dayKey) ?? [];
      newCounts.push(dayKnowbys.length);

      // Recently viewed
      const dayViews = grouped.viewsByDay.get(dayKey) ?? [];
      viewedCounts.push(dayViews.length);

      // Unused knowbys = all knowbys not viewed *up to this day*
      const unusedForDay = knowbys.filter((k) => {
        const last = parseCsvDate(k.last_viewed);
        return !last || last < startOfDay(day);
      });
      unusedCounts.push(unusedForDay.length);
    }

    // Total active members in whole range
    filteredCompletions.forEach((r) => memberSet.add(r.member_id ?? ""));

    // Precompute unused knowbys for the whole range
    const unusedFiltered = knowbys.filter((k) => {
      const last = parseCsvDate(k.last_viewed);
      return !last || last < from || last > to;
    });

    // Prepare table data (unchanged)
    const recentlyViewedForTable = filteredViews.map((v) => ({
      knowby_id: v.knowby_id ?? "",
      member_id: v.member_id,
      date: v.date,
      organisation_name: v.organisation,
      member_name: v.member_name,
      knowby_name: v.knowby_name,
    }));

    const newKnowbysForTable: KnowbyMeta[] = filteredKnowbys.map((k) => ({
      knowby_id: k.knowby_id,
      organisation: k.organisation ?? "Unknown",
      title: k.title ?? "",
      description: k.description ?? "",
      created_at: k.created_at,
      created_by_member_id: k.created_by_member_id ?? "",
      member_name: k.member_name ?? "",
      status: k.status ?? "",
      visibility: k.visibility ?? "",
      views: k.views !== undefined ? String(k.views) : "0",
      last_viewed: k.last_viewed ?? "",
    }));

    const unusedKnowbysForTable: KnowbyMeta[] = unusedFiltered.map((k) => ({
      knowby_id: k.knowby_id,
      organisation: k.organisation ?? "Unknown",
      title: k.title ?? "",
      description: k.description ?? "",
      created_at: k.created_at,
      created_by_member_id: k.created_by_member_id ?? "",
      member_name: k.member_name ?? "",
      status: k.status ?? "",
      visibility: k.visibility ?? "",
      views: k.views !== undefined ? String(k.views) : "0",
      last_viewed: k.last_viewed ?? "",
    }));

    return {
      activeMembers: memberSet.size,
      newKnowbys: filteredKnowbys.length,
      recentlyViewed: filteredViews.length,
      unusedKnowbys: unusedFiltered.length,

      activeMembersData: filteredCompletions,
      newKnowbysData: newKnowbysForTable,
      recentlyViewedData: recentlyViewedForTable,
      unusedKnowbysData: unusedKnowbysForTable,

      activeTrend: activeCounts,
      knowbyTrend: newCounts,
      viewedTrend: viewedCounts,
      unusedTrend: unusedCounts,
    };
  }, [
    from,
    to,
    filteredCompletions,
    filteredViews,
    filteredKnowbys,
    knowbys,
    grouped,
  ]);

  const StatTile = ({
    label,
    value,
    description,
    popupId,
    chartSeries, // sparkline numeric array for the tile
    popupGraph, // full chart ReactNode
    popupTable, // table ReactNode
  }: {
    label: string;
    value: number;
    description: string;
    popupId: string;
    chartSeries: number[];
    popupGraph?: React.ReactNode;
    popupTable?: React.ReactNode;
  }) => (
    <Dialog
      open={activePopup === popupId}
      onOpenChange={(open) => setActivePopup(open ? popupId : null)}
    >
      <DialogTrigger asChild>
        <div className="relative bg-muted/50 p-3 rounded-md cursor-pointer hover:bg-muted border shadow-sm flex flex-col justify-between h-[130px]">
          <ChevronDown className="absolute top-2 right-2 h-4 w-4 text-muted-foreground" />

          <div className="text-2xl font-bold">{value}</div>

          {/* Sparkline preview */}
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
            <div className="text-[10px] text-muted-foreground truncate">
              {description}
            </div>
          </div>
        </div>
      </DialogTrigger>

      {/* Popup content */}
      <DialogContent className="w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
        <h2 className="text-xl font-bold mb-2">{label}</h2>
        <DialogTitle />
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        <div className="flex flex-col gap-4">
          {/* Full chart */}
          <div className="w-full">{popupGraph ?? null}</div>

          {/* Scrollable table */}
          <div className="flex-1 h-auto max-h-[25vh] overflow-y-auto">
            {popupTable ?? null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card className="max-h-[280px] rounded-3xl shadow-none border-0 dark:border dark:border-slate-700 shadow-xl/2">
      <CardHeader>
        <CardTitle>Knowby Stats</CardTitle>
        <CardDescription>Overview of Knowby activity and usage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-[280px]">
          <StatTile
            popupId="active"
            label="Active Members"
            value={activeMembers}
            description="Members with completions in the selected range."
            chartSeries={activeTrend}
            popupGraph={
              <StatsPopupGraph
                chartSeries={activeTrend.map((y, i) => ({
                  x: i.toString(),
                  y,
                }))}
                chartLabel="Active Members"
              />
            }
            popupTable={
              <StatsTable
                data={activeMembersData}
                caption="Members with completions in the selected period"
                type="active"
              />
            }
          />

          <StatTile
            popupId="new"
            label="New Knowbys"
            value={newKnowbys}
            description="Knowbys created in the selected range."
            chartSeries={knowbyTrend}
            popupGraph={
              <StatsPopupGraph
                chartSeries={knowbyTrend.map((y, i) => ({
                  x: i.toString(),
                  y,
                }))}
                chartLabel="New Knowbys"
              />
            }
            popupTable={
              <StatsTable
                data={newKnowbysData}
                caption="Most recently created knowbys"
                type="new"
              />
            }
          />

          <StatTile
            popupId="viewed"
            label="Recently Viewed"
            value={recentlyViewed}
            description="Views in the selected range."
            chartSeries={viewedTrend}
            popupGraph={
              <StatsPopupGraph
                chartSeries={viewedTrend.map((y, i) => ({
                  x: i.toString(),
                  y,
                }))}
                chartLabel="Recently Viewed"
              />
            }
            popupTable={
              <StatsTable
                data={recentlyViewedData}
                caption="Knowbys viewed in the selected period"
                type="viewed"
              />
            }
          />

          <StatTile
            popupId="unused"
            label="Unused Knowbys"
            value={unusedKnowbys}
            description="Knowbys not viewed in the selected range."
            chartSeries={unusedTrend}
            popupGraph={
              <StatsPopupGraph
                chartSeries={unusedTrend.map((y, i) => ({
                  x: i.toString(),
                  y,
                }))}
                chartLabel="Unused Knowbys"
              />
            }
            popupTable={
              <StatsTable
                data={unusedKnowbysData}
                caption="Knowbys that haven’t been viewed recently"
                type="unused"
              />
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
