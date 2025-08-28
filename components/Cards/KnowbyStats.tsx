"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Import ShadCN dialog
import StatsTable from "@/components/Cards/StatsTable";// custom table component that changes based on stat type
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

  {
    /* for  oliver's sparkcharts */
  }
  const [activeMemberTrend, setActiveMemberTrend] = useState<number[]>([]);
  const [newKnowbyTrend, setNewKnowbyTrend] = useState<number[]>([]);
  const [recentlyEditedTrend, setRecentlyEditedTrend] = useState<number[]>([]);
  const [unusedKnowbysTrend, setUnusedKnowbysTrend] = useState<number[]>([]);

  const [activePopup, setActivePopup] = useState<null | string>(null); // New code from Sahil to track which tile was clicked

  // Data for each of the 4 tables (filtered subsets of the full csv)
  const [activeMembersData, setActiveMembersData] = useState<CompletionData[]>([]);
  const [newKnowbysData, setNewKnowbysData] = useState<KnowbyData[]>([]);
  const [recentlyViewedData, setRecentlyViewedData] = useState<KnowbyData[]>([]);
  const [unusedKnowbysData, setUnusedKnowbysData] = useState<KnowbyData[]>([]);

  // Run once on component mount to parse CSV and calculate all stats
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load completions CSV for active members
        const completionsPromise = new Promise<CompletionData[]>(
          (resolve, reject) => {
            Papa.parse("/scrapercompletions.csv", {
              download: true,
              header: true,
              skipEmptyLines: true,
              complete: (results) => resolve(results.data as CompletionData[]),
              error: (error) => reject(error),
            });
          }
        );

        // Load knowbys CSV for other stats
        const knowbysPromise = new Promise<KnowbyData[]>((resolve, reject) => {
          Papa.parse("/scraperpublished.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as KnowbyData[]),
            error: (error) => reject(error),
          });
        });

        const [completionsData, knowbysData] = await Promise.all([
          completionsPromise,
          knowbysPromise,
        ]);

        // Calculate date 30 days ago from today
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const today = new Date();

        // Active members trend
        const dailyMemberMap = new Map<string, Set<string>>();
        for (const entry of knowbysData) {
          const createdDate = parseDate(entry.created_at);
          if (
            createdDate &&
            createdDate >= thirtyDaysAgo &&
            entry.created_by_member_id?.trim()
          ) {
            const key = createdDate.toISOString().split("T")[0];
            if (!dailyMemberMap.has(key)) {
              dailyMemberMap.set(key, new Set());
            }
            dailyMemberMap.get(key)?.add(entry.created_by_member_id);
          }
        }

        // --- Build completion dates per knowby and a helper to get "last interaction" ---
        // Map: knowby_id -> array of completion Date objects (from ALL data)
        const completionDatesByKnowby = new Map<string, Date[]>();
        for (const c of completionsData) {
          const d = parseDate(c.date);
          if (!d) continue;
          const arr = completionDatesByKnowby.get(c.knowby_id) || [];
          arr.push(d);
          completionDatesByKnowby.set(c.knowby_id, arr);
        }

        // Helper: get the most recent interaction date for a knowby
        // (max of last_viewed and any completion dates). Returns null if none.
        const getLastInteraction = (k: KnowbyData): Date | null => {
          const lv = parseDate(k.last_viewed);
          const compDates = completionDatesByKnowby.get(k.knowby_id) || [];
          const latestComp =
            compDates.length > 0 ? new Date(Math.max(...compDates.map(x => x.getTime()))) : null;

          if (lv && latestComp) return new Date(Math.max(lv.getTime(), latestComp.getTime()));
          return lv ?? latestComp ?? null;
        };


        const activeTrend: number[] = [];
        const dateCursor1 = new Date(thirtyDaysAgo);
        while (dateCursor1 <= today) {
          const key = dateCursor1.toISOString().split("T")[0];
          activeTrend.push(dailyMemberMap.get(key)?.size || 0);
          dateCursor1.setDate(dateCursor1.getDate() + 1);
        }
        setActiveMemberTrend(activeTrend);

        // New knowbys trend
        const dailyKnowbyMap = new Map<string, number>();
        for (const entry of knowbysData) {
          const createdDate = parseDate(entry.created_at);
          if (createdDate && createdDate >= thirtyDaysAgo) {
            const key = createdDate.toISOString().split("T")[0];
            dailyKnowbyMap.set(key, (dailyKnowbyMap.get(key) || 0) + 1);
          }
        }

        const knowbyTrend: number[] = [];
        const dateCursor2 = new Date(thirtyDaysAgo);
        while (dateCursor2 <= today) {
          const key = dateCursor2.toISOString().split("T")[0];
          knowbyTrend.push(dailyKnowbyMap.get(key) || 0);
          dateCursor2.setDate(dateCursor2.getDate() + 1);
        }
        setNewKnowbyTrend(knowbyTrend);

        // Recently Viewed Knowbys trend (by last_viewed date)
        const dailyEditedMap = new Map<string, number>();
        for (const entry of knowbysData) {
          const lastViewed = parseDate(entry.last_viewed);
          if (lastViewed && lastViewed >= thirtyDaysAgo) {
            const key = lastViewed.toISOString().split("T")[0];
            dailyEditedMap.set(key, (dailyEditedMap.get(key) || 0) + 1);
          }
        }

        const editedTrend: number[] = [];
        const dateCursor3 = new Date(thirtyDaysAgo);
        while (dateCursor3 <= today) {
          const key = dateCursor3.toISOString().split("T")[0];
          editedTrend.push(dailyEditedMap.get(key) || 0);
          dateCursor3.setDate(dateCursor3.getDate() + 1);
        }

        setRecentlyEditedTrend(editedTrend);


        // Unused knowbys trend (not viewed in last 30 days)
        // build once from your existing helper
        const lastInteractionByKnowby = new Map<string, Date>();
        for (const k of knowbysData) {
          const li = getLastInteraction(k);   // you already defined this
          if (li) lastInteractionByKnowby.set(k.knowby_id, li);
        }

        const becameUnusedTrend: number[] = [];
        {
          const d = new Date(thirtyDaysAgo);
          while (d <= today) {
            const cut = new Date(d);
            cut.setDate(cut.getDate() - 30);

            // date-only comparison
            const cutKey = cut.toISOString().split("T")[0];

            let n = 0;
            for (const li of lastInteractionByKnowby.values()) {
              const liKey = li.toISOString().split("T")[0];
              if (liKey === cutKey) n++; // crossed threshold today
            }
            becameUnusedTrend.push(n);
            d.setDate(d.getDate() + 1);
          }
        }
        setUnusedKnowbysTrend(becameUnusedTrend);



        // Active members based on completions in last 30 days
        const recentCompletions = completionsData.filter((d) => {
          const completionDate = parseDate(d.date);
          return completionDate && completionDate >= thirtyDaysAgo;
        });

        const activeMembersSet = new Set(
          recentCompletions
            .map((d) => d.member_id)
            .filter((id) => id && id.trim() !== "")
        );

        // New knowbys created in last 30 days
        const recentCreations = knowbysData.filter((d) => {
          const createdDate = parseDate(d.created_at);
          return createdDate && createdDate >= thirtyDaysAgo;
        });

        // Knowbys with last_viewed date within the last 30 days
        const recentlyViewed = knowbysData.filter((d) => {
          const lastViewed = parseDate(d.last_viewed);
          return lastViewed && lastViewed >= thirtyDaysAgo;
        });

        // Knowbys with 0 views OR last viewed over 30 days ago
        const unusedKnowbys = knowbysData.filter((k) => {
          const lastIx = getLastInteraction(k);
          return !lastIx || lastIx < thirtyDaysAgo;
        });

        // Set the dashboard tile numbers
        setStats({
          activeMembers: activeMembersSet.size,
          newKnowbys: recentCreations.length,
          recentlyViewed: recentlyViewed.length,
          unusedKnowbys: unusedKnowbys.length,
        });

        // Set the data to be shown in popups
        setActiveMembersData(recentCompletions);
        setNewKnowbysData(recentCreations);
        setRecentlyViewedData(recentlyViewed);
        setUnusedKnowbysData(unusedKnowbys);
      } catch (error) {
        console.error("Error parsing CSVs:", error);
      }
    };

    loadData();
  }, []);

  // Helper function to parse dates in DD/MM/YYYY format
  const parseDate = (dateString: string): Date | null => {
    if (!dateString || dateString.trim() === "") return null;

    const parts = dateString.split("/");
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    const year = parseInt(parts[2]);

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const baseChartOptions: ApexOptions = {
    chart: {
      type: "area",
      sparkline: { enabled: true },
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
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

  // Reusable stat tile component, eaach one opens a different dialog
  const StatTile = ({
    label,
    value,
    description,
    popupId,
    popupContent,
    chartSeries,
  }: {
    label: string; // Label for stat
    value: number; // Number to display in tile
    description: string; // description under the label
    popupId: string; // ID to manage which popup is open
    popupContent: React.ReactNode; // JSX content or tables displayed in popup
    chartSeries: (number | null)[] | null; // now allows nulls in data OR no chart
  }) => (
    // Tile is wrapped in Dialog component that opens depending on activePopup state
    <Dialog
      open={activePopup === popupId} // Set popup as open if ID matches current activePopup
      onOpenChange={(open) => setActivePopup(open ? popupId : null)} // When popup open state changes (opened or closed) update activePopup
    >
      {/* DialogTrigger asChild lets us use the div for the tile as the clickable trigger for the popup*/}
      <DialogTrigger asChild>
        <div className="relative bg-muted/50 p-6 rounded-lg cursor-pointer hover:bg-muted transition border shadow-md">
          {/* Number + optional chart in same row */}
          <div className="flex justify-between mb-2">
            <div className="text-3xl font-bold">{value}</div>

            {/* Only render chart if we have data */}
            {chartSeries && chartSeries.length > 0 ? (
              <div className="w-24 h-6">
                <Chart
                  options={baseChartOptions}
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

          {/* Text details */}
          <div className="text-sm font-medium mb-1">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>

          {/* Chevron bottom-right */}
          <ChevronDown className="absolute bottom-2 right-2 h-4 w-4 text-muted-foreground" />
        </div>
      </DialogTrigger>

      {/* Popup content */}
      <DialogContent className="w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
        <h2 className="text-xl font-bold mb-2">{label}</h2>
        <DialogTitle />
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="overflow-scroll max-h-[500px]">
          {popupContent}
        </div>
      </DialogContent>
    </Dialog>
  );
  //test
  return (
    // Grid layout for the 4 stat tiles,
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Each StatTile has its own popupId and can have custom popupContent for different tables/graphs*/}

      <StatTile
        popupId="active"
        label="Active Members"
        value={stats.activeMembers}
        description="Members with completions in the last 30 days."
        chartSeries={activeMemberTrend}
        popupContent={
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
        label="Recently Viewed Knowbys"
        value={stats.recentlyViewed}
        description="Knowbys viewed in the last 30 days."
        chartSeries={recentlyEditedTrend}
        popupContent={
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
        chartSeries={unusedKnowbysTrend}
        popupContent={
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