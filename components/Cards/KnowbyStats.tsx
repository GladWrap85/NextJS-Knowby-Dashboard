"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // ShadCN dialog
import StatsTable from "@/components/Cards/StatsTable";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { ChevronDown } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { DateRange } from "react-day-picker";
import { parse, isWithinInterval, subDays, startOfDay, endOfDay } from "date-fns";
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

// helper to parse dd/MM/yyyy strings from your CSVs
function parseCsvDate(ds?: string): Date | null {
  if (!ds) return null;
  return parse(ds, "dd/MM/yyyy", new Date());
}

export default function KnowbyStats({ selectedDateRange }: Props) {
  const { views, completions, status } = useKnowbyData();
  const [activePopup, setActivePopup] = useState<null | string>(null);

  // guard defaults
  const now = new Date();
  const rawFrom = selectedDateRange?.from ?? subDays(now, 30);
  const rawTo = selectedDateRange?.to ?? now;

  // normalize so we include the whole 'to' day
  const from = startOfDay(rawFrom);
  const to = endOfDay(rawTo);

  // helper already present
  function parseCsvDate(ds?: string): Date | null {
    if (!ds) return null;
    return parse(ds, "dd/MM/yyyy", new Date());
  }

  // *** NEW: filtered slices used everywhere below ***
  const filteredCompletions = completions.filter(r => {
    const d = parseCsvDate((r as any)?.date);
    return d && isWithinInterval(d, { start: from, end: to });
  });

  const filteredViews = views.filter(r => {
    const d = parseCsvDate((r as any)?.date);
    return d && isWithinInterval(d, { start: from, end: to });
  });


  // compute stats + trend arrays
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

    const trendDays = 30;
    const activeCounts: number[] = [];
    const newCounts: number[] = [];
    const viewedCounts: number[] = [];
    const unusedCounts: number[] = [];

    // build per-day buckets using the already-filtered arrays
    for (let i = 0; i < trendDays; i++) {
      const day = subDays(to, trendDays - 1 - i);
      const start = startOfDay(day);
      const end = endOfDay(day);

      const cDay = filteredCompletions.filter(r => {
        const d = parseCsvDate((r as any)?.date);
        return d && isWithinInterval(d, { start, end });
      });
      const vDay = filteredViews.filter(r => {
        const d = parseCsvDate((r as any)?.date);
        return d && isWithinInterval(d, { start, end });
      });

      activeCounts.push(new Set(cDay.map(r => (r as any).member_id)).size);
      newCounts.push(0);
      viewedCounts.push(vDay.length);
      unusedCounts.push(0);
    }

    // summary numbers from filtered arrays
    filteredCompletions.forEach(r => memberSet.add((r as any).member_id));

    return {
      activeMembers: memberSet.size,
      newKnowbys: 0,
      recentlyViewed: filteredViews.length,
      unusedKnowbys: 0,

      // *** IMPORTANT: pass filtered arrays to tables ***
      activeMembersData: filteredCompletions,
      newKnowbysData: [],
      recentlyViewedData: filteredViews,   // was: views (unfiltered)
      unusedKnowbysData: [],

      activeTrend: activeCounts,
      knowbyTrend: newCounts,
      viewedTrend: viewedCounts,
      unusedTrend: unusedCounts,
    };
  }, [from, to, filteredCompletions, filteredViews]);


  // reusable tile
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
    chartSeries: (number | null)[];
  }) => (
    <Dialog
      open={activePopup === popupId}
      onOpenChange={open => setActivePopup(open ? popupId : null)}
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
            <div className="text-[10px] text-muted-foreground truncate">
              {description}
            </div>
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

  return (
    <Card className="max-h-[280px] rounded-3xl shadow-none  border-0 dark:border dark:border-slate-700 shadow-xl/2">
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
            popupContent={
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
            popupContent={
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
            popupContent={
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
            description="Not used in the selected range."
            chartSeries={unusedTrend}
            popupContent={
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
