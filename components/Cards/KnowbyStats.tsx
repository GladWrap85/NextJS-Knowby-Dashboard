'use client'

import { useEffect, useState } from "react";
import Papa from "papaparse";

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
    unusedKnowbys: 0
  });

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
            .filter(d => {
              const createdDate = parseDate(d.created_at);
              return createdDate && createdDate >= thirtyDaysAgo;
            })
            .map(d => d.created_by_member_id)
            .filter(id => id && id.trim() !== '')
        );

        // New Knowbys Created - knowbys created in last 30 days
        const newKnowbys = data.filter(d => {
          const createdDate = parseDate(d.created_at);
          return createdDate && createdDate >= thirtyDaysAgo;
        });

        // Recently Edited Knowbys - knowbys with last_viewed in last 30 days
        const recentlyEdited = data.filter(d => {
          const lastViewed = parseDate(d.last_viewed);
          return lastViewed && lastViewed >= thirtyDaysAgo;
        });

        // Unused Knowbys - knowbys with no views or last viewed more than 30 days ago
        const unusedKnowbys = data.filter(d => {
          const views = parseInt(d.views) || 0;
          const lastViewed = parseDate(d.last_viewed);
          
          // Consider knowby unused if no views or last viewed more than 30 days ago
          return views === 0 || !lastViewed || lastViewed < thirtyDaysAgo;
        });

        setStats({
          activeMembers: activeMembers.size,
          newKnowbys: newKnowbys.length,
          recentlyEdited: recentlyEdited.length,
          unusedKnowbys: unusedKnowbys.length
        });
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
      }
    });
  }, []);

  // Helper function to parse dates in DD/MM/YYYY format
  const parseDate = (dateString: string): Date | null => {
    if (!dateString || dateString.trim() === '') return null;
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    const year = parseInt(parts[2]);
    
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Active Members */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="text-3xl font-bold mb-2">
          {stats.activeMembers}
        </div>
        <div className="text-sm font-medium mb-1">
          Active Members
        </div>
        <div className="text-xs text-muted-foreground">
          Active members in the last 30 days.
        </div>
      </div>

      {/* New Knowbys Created */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="text-3xl font-bold mb-2">
          {stats.newKnowbys}
        </div>
        <div className="text-sm font-medium mb-1">
          New Knowbys Created
        </div>
        <div className="text-xs text-muted-foreground">
          Knowbys created in the last 30 days.
        </div>
      </div>

      {/* Recently Edited Knowbys */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="text-3xl font-bold mb-2">
          {stats.recentlyEdited}
        </div>
        <div className="text-sm font-medium mb-1">
          Recently Edited Knowbys
        </div>
        <div className="text-xs text-muted-foreground">
          Knowbys edited in the last 30 days.
        </div>
      </div>

      {/* Unused Knowbys */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="text-3xl font-bold mb-2">
          {stats.unusedKnowbys}
        </div>
        <div className="text-sm font-medium mb-1">
          Unused Knowbys
        </div>
        <div className="text-xs text-muted-foreground">
          Knowbys not used in the last 30 days.
        </div>
      </div>
    </div>
  );
}