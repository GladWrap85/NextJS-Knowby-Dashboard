"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; // Import ShadCN dialog
import { TableDemo } from "@/components/Cards/Table"; // temporary table import for example purposes

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

  const [activePopup, setActivePopup] = useState<null | string>(null); // New code from Sahil to track which tile was clicked

  useEffect(() => {
    Papa.parse("/testknowbys.csv", {
      // using testknowbys.csv file because one given has no stats within 30 days.
      // change back to 'knowbys.csv' file to see result.
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as KnowbyData[];

        // Calculate stats
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Active Members - unique members who created knowbys in last 30 days
        const activeMembers = new Set(
          data
            .filter((d) => {
              const createdDate = parseDate(d.created_at);
              return createdDate && createdDate >= thirtyDaysAgo;
            })
            .map((d) => d.created_by_member_id)
            .filter((id) => id && id.trim() !== "")
        );

        // New Knowbys Created - knowbys created in last 30 days
        const newKnowbys = data.filter((d) => {
          const createdDate = parseDate(d.created_at);
          return createdDate && createdDate >= thirtyDaysAgo;
        });

        // Recently Edited Knowbys - knowbys with last_viewed in last 30 days
        const recentlyEdited = data.filter((d) => {
          const lastViewed = parseDate(d.last_viewed);
          return lastViewed && lastViewed >= thirtyDaysAgo;
        });

        // Unused Knowbys - knowbys with no views or last viewed more than 30 days ago
        const unusedKnowbys = data.filter((d) => {
          const views = parseInt(d.views) || 0;
          const lastViewed = parseDate(d.last_viewed);

          // Consider knowby unused if no views or last viewed more than 30 days ago
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

  // Reusable stat tile with trigger
  const StatTile = ({
    label,
    value,
    description,
    popupId,
    popupContent,
  }: {
    label: string; // Label for stat
    value: number; // Number to display in tile
    description: string; // description under the label
    popupId: string; // ID to manage which popup is open
    popupContent: React.ReactNode; // JSX content or tables displayed in popup
  }) => (
    // Tile is wrapped in Dialog component that opens depending on activePopup state
    <Dialog
      open={activePopup === popupId} // Set popup as open if ID matches current activePopup
      onOpenChange={(open) => setActivePopup(open ? popupId : null)} // When popup open state changes (opened or closed) update activePopup
    >
      {/* DialogTrigger asChild lets us use the div for the tile as the clickable trigger for the popup*/}
      <DialogTrigger asChild>
        <div className="bg-muted/50 p-6 rounded-lg cursor-pointer hover:bg-muted transition">
          <div className="text-3xl font-bold mb-2">{value}</div>
          <div className="text-sm font-medium mb-1">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </DialogTrigger>
      {/* DialogContent is the popup that appears when this tile is clicked */}
      <DialogContent>
        <h2 className="text-xl font-bold mb-2">{label}</h2>
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
      />
      <StatTile
        popupId="new"
        label="New Knowbys Created"
        value={stats.newKnowbys}
        description="Knowbys created in the last 30 days."
        popupContent={<TableDemo />}
      />
      <StatTile
        popupId="edited"
        label="Recently Edited Knowbys"
        value={stats.recentlyEdited}
        description="Knowbys edited in the last 30 days."
        popupContent={<TableDemo />}
      />
      <StatTile
        popupId="unused"
        label="Unused Knowbys"
        value={stats.unusedKnowbys}
        description="Knowbys not used in the last 30 days."
        popupContent={<TableDemo />}
      />
    </div>
  );
}
