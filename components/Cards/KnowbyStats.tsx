"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
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

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface KnowbyData {
  knowby_id: string;
  organisation: string;
  title: string;
  description: string;
  created_at: string;
  created_by_member_id: string;
  member_name: string;
  status: string;
  visibility: string;
  views: string;
  last_viewed: string;
}

interface CompletionData {
  organisation_name: string;
  knowby_id: string;
  knowby_name: string;
  member_id: string;
  member_name: string;
  date: string;
}

interface StatsData {
  activeMembers: number;
  newKnowbys: number;
  recentlyViewed: number;
  unusedKnowbys: number;
}

export default function KnowbyStats() {
  const [stats, setStats] = useState<StatsData>({
    activeMembers: 0,
    newKnowbys: 0,
    recentlyViewed: 0,
    unusedKnowbys: 0,
  });

  const [activeMemberTrend, setActiveMemberTrend] = useState<number[]>([]);
  const [newKnowbyTrend, setNewKnowbyTrend] = useState<number[]>([]);
  const [recentlyEditedTrend, setRecentlyEditedTrend] = useState<number[]>([]);
  const [recentlyUnusedTrend, setRecentlyUnusedTrend] = useState<number[]>([]);

  const [activePopup, setActivePopup] = useState<null | string>(null);

  // Popup series with x-axis labels
  const [activeChartSeries, setActiveChartSeries] = useState<
    { x: string; y: number }[]
  >([]);
  const [newChartSeries, setNewChartSeries] = useState<
    { x: string; y: number }[]
  >([]);
  const [viewedChartSeries, setViewedChartSeries] = useState<
    { x: string; y: number }[]
  >([]);
  const [unusedChartSeries, setUnusedChartSeries] = useState<
    { x: string; y: number }[]
  >([]);

  const [activeChartOptions, setActiveChartOptions] =
    useState<ApexOptions | null>(null);
  const [newChartOptions, setNewChartOptions] = useState<ApexOptions | null>(
    null
  );
  const [viewedChartOptions, setViewedChartOptions] =
    useState<ApexOptions | null>(null);
  const [unusedChartOptions, setUnusedChartOptions] =
    useState<ApexOptions | null>(null);

  const [activeMembersData, setActiveMembersData] = useState<CompletionData[]>(
    []
  );
  const [newKnowbysData, setNewKnowbysData] = useState<KnowbyData[]>([]);
  const [recentlyViewedData, setRecentlyViewedData] = useState<KnowbyData[]>(
    []
  );
  const [unusedKnowbysData, setUnusedKnowbysData] = useState<KnowbyData[]>([]);

  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const baseSparkOptions: ApexOptions = {
    chart: { type: "area", sparkline: { enabled: true } },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 1,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    tooltip: { enabled: false },
    yaxis: { show: false },
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const completionsData: CompletionData[] = await new Promise(
          (resolve, reject) =>
            Papa.parse("/scrapercompletions.csv", {
              download: true,
              header: true,
              skipEmptyLines: true,
              complete: (results) => resolve(results.data as CompletionData[]),
              error: reject,
            })
        );

        const knowbysData: KnowbyData[] = await new Promise((resolve, reject) =>
          Papa.parse("/scraperpublished.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as KnowbyData[]),
            error: reject,
          })
        );

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();

        const formatDateKey = (d: Date) =>
          `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1)
            .toString()
            .padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;

        // --- Active Members Trend ---
        const dailyMemberMap = new Map<string, Set<string>>();
        completionsData.forEach((c) => {
          const d = parseDate(c.date);
          if (!d || d < thirtyDaysAgo || !c.member_id?.trim()) return;
          const key = formatDateKey(d); // Local date key
          if (!dailyMemberMap.has(key)) dailyMemberMap.set(key, new Set());
          dailyMemberMap.get(key)?.add(c.member_id);
        });

        const activeTrend: number[] = [];
        const cursor1 = new Date(thirtyDaysAgo);
        while (cursor1 <= today) {
          const key = formatDateKey(cursor1);
          activeTrend.push(dailyMemberMap.get(key)?.size || 0);
          cursor1.setDate(cursor1.getDate() + 1);
        }
        setActiveMemberTrend(activeTrend);

        // --- New Knowbys Trend ---
        const dailyKnowbyMap = new Map<string, number>();
        knowbysData.forEach((k) => {
          const d = parseDate(k.created_at);
          if (!d || d < thirtyDaysAgo) return;
          const key = formatDateKey(d); // Local date key
          dailyKnowbyMap.set(key, (dailyKnowbyMap.get(key) || 0) + 1);
        });

        const newTrend: number[] = [];
        const cursor2 = new Date(thirtyDaysAgo);
        while (cursor2 <= today) {
          const key = formatDateKey(cursor2);
          newTrend.push(dailyKnowbyMap.get(key) || 0);
          cursor2.setDate(cursor2.getDate() + 1);
        }
        setNewKnowbyTrend(newTrend);

        // --- Recently Viewed Trend ---
        const dailyEditedMap = new Map<string, number>();
        knowbysData.forEach((k) => {
          const d = parseDate(k.last_viewed);
          if (!d || d < thirtyDaysAgo) return;
          const key = formatDateKey(d); // Local date key
          dailyEditedMap.set(key, (dailyEditedMap.get(key) || 0) + 1);
        });

        const viewedTrend: number[] = [];
        const cursor3 = new Date(thirtyDaysAgo);
        while (cursor3 <= today) {
          const key = formatDateKey(cursor3);
          viewedTrend.push(dailyEditedMap.get(key) || 0);
          cursor3.setDate(cursor3.getDate() + 1);
        }
        setRecentlyEditedTrend(viewedTrend);

        // --- Unused Knowbys Trend ---
        const dailyUnusedMap = new Map<string, number>();
        const last30DaysDates: Date[] = [];
        const cursor = new Date(thirtyDaysAgo);
        while (cursor <= today) {
          last30DaysDates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }

        last30DaysDates.forEach((date) => {
          let count = 0;
          knowbysData.forEach((k) => {
            const last = parseDate(k.last_viewed);
            // Count Knowby if it hasn't been viewed in the last 30 days
            if (
              !last ||
              last < new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000)
            ) {
              count++;
            }
          });
          dailyUnusedMap.set(formatDateKey(date), count);
        });

        const unusedTrend = last30DaysDates.map(
          (d) => dailyUnusedMap.get(formatDateKey(d)) || 0
        );
        setRecentlyUnusedTrend(unusedTrend);

        // --- Dashboard stats ---
        const recentCompletions = completionsData.filter(
          (d) => parseDate(d.date) && parseDate(d.date)! >= thirtyDaysAgo
        );
        const activeMembersSet = new Set(
          recentCompletions.map((d) => d.member_id).filter(Boolean)
        );
        const recentCreations = knowbysData.filter(
          (d) => parseDate(d.created_at)! >= thirtyDaysAgo
        );
        const recentlyViewed = knowbysData.filter(
          (d) => parseDate(d.last_viewed)! >= thirtyDaysAgo
        );
        const unusedKnowbys = knowbysData.filter((k) => {
          const last = parseDate(k.last_viewed);
          return !last || last < thirtyDaysAgo;
        });

        setStats({
          activeMembers: activeMembersSet.size,
          newKnowbys: recentCreations.length,
          recentlyViewed: recentlyViewed.length,
          unusedKnowbys: unusedKnowbys.length,
        });

        setActiveMembersData(recentCompletions);
        setNewKnowbysData(recentCreations);
        setRecentlyViewedData(recentlyViewed);
        setUnusedKnowbysData(unusedKnowbys);
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, []);

  // --- Generate last 30 days labels for charts (local dates) ---
  const generateLast30DaysLabels = (): string[] => {
    const labels: string[] = [];
    const today = new Date();
    const cursor = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 29)
    );
    for (let i = 0; i < 30; i++) {
      const day = cursor.getUTCDate().toString().padStart(2, "0");
      const month = (cursor.getUTCMonth() + 1).toString().padStart(2, "0");
      labels.push(`${day}/${month}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return labels;
  };

  useEffect(() => {
    const labels = generateLast30DaysLabels();

    // Reuse this helper to match trend arrays to labels
    const seriesFromTrend = (trend: number[]) =>
      labels.map((label, i) => ({ x: label, y: trend[i] || 0 }));

    setActiveChartSeries(seriesFromTrend(activeMemberTrend));
    setNewChartSeries(seriesFromTrend(newKnowbyTrend));
    setViewedChartSeries(seriesFromTrend(recentlyEditedTrend));
    setUnusedChartSeries(seriesFromTrend(recentlyUnusedTrend));

    const xaxisOptions = {
      xaxis: { categories: labels, labels: { rotate: -45 } },
    };
    setActiveChartOptions(xaxisOptions);
    setNewChartOptions(xaxisOptions);
    setViewedChartOptions(xaxisOptions);
    setUnusedChartOptions(xaxisOptions);
  }, [
    activeMemberTrend,
    newKnowbyTrend,
    recentlyEditedTrend,
    recentlyUnusedTrend,
  ]);

  const StatTile = ({
  label,
  value,
  description,
  popupId,
  chartSeries, // sparkline numeric array for the tile
  popupGraph, // ReactNode (chart-only)
  popupTable, // ReactNode (table-only)
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
      <div className="relative bg-muted/50 p-6 rounded-lg cursor-pointer hover:bg-muted transition border shadow-md">
        <div className="flex justify-between mb-2">
          <div className="text-3xl font-bold">{value}</div>

          {/* Tile sparkline (small preview) */}
          {chartSeries && chartSeries.length > 0 ? (
            <div className="w-24 h-6">
              <Chart
                options={baseSparkOptions}
                series={[{ name: label, data: chartSeries }]}
                type="area"
                height={40}
              />
            </div>
          ) : (
            <div className="w-24 h-6 mb-3 flex items-center justify-center text-xs text-muted-foreground">
              No data
            </div>
          )}
        </div>

        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        <ChevronDown className="absolute bottom-2 right-2 h-4 w-4 text-muted-foreground" />
      </div>
    </DialogTrigger>

    {/* Popup content: chart (non-scroll) above, table (scrollable) below */}
    <DialogContent className="w-full h-auto max-h-[80vh] sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
      <h2 className="text-xl font-bold mb-2">{label}</h2>
      <DialogTitle />
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="flex flex-col gap-4">
        {/* Chart area — always visible */}
        <div className="w-full">{popupGraph ?? null}</div>

        {/* Table area — scrolls independently */}
        <div className="flex-1 h-auto max-h-[25vh] overflow-y-auto">
          {popupTable ?? null}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

/* --- Now the four StatTile usages: replace existing usages with these --- */

return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <StatTile
      popupId="active"
      label="Active Members"
      value={stats.activeMembers}
      description="Members with completions in the last 30 days."
      chartSeries={activeMemberTrend}
      popupGraph={
        <StatsPopupGraph
          chartSeries={activeChartSeries}
          chartLabel="Active Members"
          chartOptions={activeChartOptions ?? {}}
          // height can be controlled via StatsPopupGraph if desired
        />
      }
      popupTable={
        <StatsTable
          data={activeMembersData}
          caption="Members with the most completions in the last 30 days"
          type="active"
        />
      }
    />

    <StatTile
      popupId="new"
      label="New Knowbys Created"
      value={stats.newKnowbys}
      description="Knowbys created in the last 30 days."
      chartSeries={newKnowbyTrend}
      popupGraph={
        <StatsPopupGraph
          chartSeries={newChartSeries}
          chartLabel="New Knowbys Created"
          chartOptions={newChartOptions ?? {}}
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
      label="Recently Viewed Knowbys"
      value={stats.recentlyViewed}
      description="Knowbys viewed in the last 30 days."
      chartSeries={recentlyEditedTrend}
      popupGraph={
        <StatsPopupGraph
          chartSeries={viewedChartSeries}
          chartLabel="Recently Viewed Knowbys"
          chartOptions={viewedChartOptions ?? {}}
        />
      }
      popupTable={
        <StatsTable
          data={recentlyViewedData}
          caption="Knowbys most recently viewed"
          type="viewed"
        />
      }
    />

    <StatTile
      popupId="unused"
      label="Unused Knowbys"
      value={stats.unusedKnowbys}
      description="Knowbys not used in the last 30 days."
      chartSeries={recentlyUnusedTrend}
      popupGraph={
        <StatsPopupGraph
          chartSeries={unusedChartSeries}
          chartLabel="Unused Knowbys"
          chartOptions={unusedChartOptions ?? {}}
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
);
}