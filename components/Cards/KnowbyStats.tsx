"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // Import ShadCN dialog
import { TableDemo } from "@/components/Cards/Table"; // temporary table import for example purposes
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

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

interface StatsData {
  activeMembers: number;
  newKnowbys: number;
  recentlyEdited: number;
  unusedKnowbys: number;
}

export default function KnowbyStats() {
  const [stats, setStats] = useState<StatsData>({
    activeMembers: 0,
    newKnowbys: 0,
    recentlyEdited: 0,
    unusedKnowbys: 0,
  });

  const [activeMemberTrend, setActiveMemberTrend] = useState<number[]>([]);
  const [newKnowbyTrend, setNewKnowbyTrend] = useState<number[]>([]);
  const [recentlyEditedTrend, setRecentlyEditedTrend] = useState<number[]>([]);

  const [activePopup, setActivePopup] = useState<null | string>(null); // New code from Sahil to track which tile was clicked

  useEffect(() => {
    Papa.parse("/knowbys.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as KnowbyData[];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();

        // Active members trend
        const dailyMemberMap = new Map<string, Set<string>>();
        for (const entry of data) {
          const createdDate = parseDate(entry.created_at);
          if (createdDate && createdDate >= thirtyDaysAgo && entry.created_by_member_id?.trim()) {
            const key = createdDate.toISOString().split("T")[0];
            if (!dailyMemberMap.has(key)) {
              dailyMemberMap.set(key, new Set());
            }
            dailyMemberMap.get(key)?.add(entry.created_by_member_id);
          }
        }

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
        for (const entry of data) {
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

        // Recently Edited Knowbys trend (by last_viewed date)
        const dailyEditedMap = new Map<string, number>();
        for (const entry of data) {
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


        // Basic stats
        const activeMembers = new Set(
          data
            .filter((d) => {
              const createdDate = parseDate(d.created_at);
              return createdDate && createdDate >= thirtyDaysAgo;
            })
            .map((d) => d.created_by_member_id)
            .filter((id) => id && id.trim() !== "")
        );

        const newKnowbys = data.filter((d) => {
          const createdDate = parseDate(d.created_at);
          return createdDate && createdDate >= thirtyDaysAgo;
        });

        const recentlyEdited = data.filter((d) => {
          const lastViewed = parseDate(d.last_viewed);
          return lastViewed && lastViewed >= thirtyDaysAgo;
        });

        const unusedKnowbys = data.filter((d) => {
          const views = parseInt(d.views) || 0;
          const lastViewed = parseDate(d.last_viewed);
          return views === 0 || !lastViewed || lastViewed < thirtyDaysAgo;
        });

        setStats({
          activeMembers: activeMembers.size,
          newKnowbys: newKnowbys.length,
          recentlyEdited: recentlyEdited.length,
          unusedKnowbys: unusedKnowbys.length,
        });
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
      },
    });
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

  // Reusable stat tile with trigger
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
    chartSeries: (number | null)[] | null; //expects numeric data for trendline but can take nulls in data or no chart
  }) => (
    // Tile is wrapped in Dialog component that opens depending on activePopup state
    <Dialog
      open={activePopup === popupId} // Set popup as open if ID matches current activePopup
      onOpenChange={(open) => setActivePopup(open ? popupId : null)} // When popup open state changes (opened or closed) update activePopup
    >
      {/* DialogTrigger asChild lets us use the div for the tile as the clickable trigger for the popup*/}
      <DialogTrigger asChild>
        <div className="bg-muted/50 p-6 rounded-lg cursor-pointer hover:bg-muted transition border">
          <div className="flex justify-between mb-2 gap-6">
            <div className="text-3xl font-bold">{value}</div>

            {chartSeries && chartSeries.length > 0 ? (
              <div className="w-24 h6 mb3">
                <Chart
                options={baseChartOptions}
                series={[{ name: label, data: chartSeries }]}
                type="area"
                height={40}
                />
              </div>
            ) : (
              <div className="w-24 h-6 mb-3 flex items-center justify-center text-xs text-muted-foreground">
                no data
              </div>
            )}
            </div>
        {/* Text Details */}
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      </DialogTrigger>
      {/* DialogContent is the popup that appears when this tile is clicked */}
      <DialogContent>
        <h2 className="text-xl font-bold mb-2">{label}</h2>
        <DialogTitle>{label}</DialogTitle>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {popupContent} {/* inserted JSX content */}
      </DialogContent>
    </Dialog>
  );

  return (
    // Grid layout for the 4 stat tiles,
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Each StatTile has its own popupId and can have custom popupContent for different tables/graphs*/}

      <StatTile
        popupId="active"
        label="Active Members"
        value={stats.activeMembers}
        description="Active members in the last 30 days."
        popupContent={<TableDemo />} // Custom JSX shown in the popup using tableDemo for examples
        chartSeries={activeMemberTrend}
      />
      <StatTile
        popupId="new"
        label="New Knowbys Created"
        value={stats.newKnowbys}
        description="Knowbys created in the last 30 days."
        popupContent={<TableDemo />}
        chartSeries={newKnowbyTrend}
      />
      <StatTile
        popupId="edited"
        label="Recently Edited Knowbys"
        value={stats.recentlyEdited}
        description="Knowbys edited in the last 30 days."
        popupContent={<TableDemo />}
        chartSeries={recentlyEditedTrend}
      />
      <StatTile
        popupId="unused"
        label="Unused Knowbys"
        value={stats.unusedKnowbys}
        description="Knowbys not used in the last 30 days."
        popupContent={<TableDemo />}
        chartSeries={null}
      />
    </div>
  );
}
