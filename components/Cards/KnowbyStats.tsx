'use client'

import { useEffect, useState } from "react";
import Papa from "papaparse";
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

  // --- helpers ---
  const parseDate = (dateString: string): Date | null => {
    if (!dateString || dateString.trim() === "") return null;
    // expects DD/MM/YYYY like your knowbys.csv; extend here if needed
    const parts = dateString.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const loadCsv = <T,>(url: string) =>
    new Promise<T[]>((resolve, reject) => {
      Papa.parse<T>(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data as T[]),
        error: (err) => reject(err),
      });
    });

  // Try common header names for user/date across the three files
  const USER_KEYS = ["created_by_member_id", "member_id", "user_id", "userid", "memberID"];
  const DATE_KEYS = ["created_at", "date", "viewed_at", "completed_at", "timestamp", "last_viewed"];

  const getFirstPresent = (obj: any, keys: string[]) => {
    for (const k of keys) {
      if (obj?.[k] != null && String(obj[k]).trim() !== "") return obj[k];
    }
    return null;
  };

  const getUserId = (row: any): string | null => {
    const raw = getFirstPresent(row, USER_KEYS);
    if (!raw) return null;
    return String(raw).trim();
  };

  const getActivityDate = (row: any): Date | null => {
    const raw = getFirstPresent(row, DATE_KEYS);
    if (!raw) return null;
    // If your views/completions use DD/MM/YYYY as well, parseDate works.
    // If they use ISO (YYYY-MM-DD) you can add a quick branch:
    const s = String(raw).trim();
    if (s.includes("-")) { // crude ISO detection
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    return parseDate(s);
  };

  useEffect(() => {
    (async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();

        // Load all three
        const [knowbys, views, completions] = await Promise.all([
          loadCsv<KnowbyData>("/knowbys.csv"),
          loadCsv<any>("/views.csv"),
          loadCsv<any>("/completions.csv"),
        ]);

        // ---------- ACTIVE MEMBERS (union across all three) ----------
        // Build daily map: dateKey -> Set<userId>
        const dailyUsers = new Map<string, Set<string>>();

        const pushRow = (row: any) => {
          const uid = getUserId(row);
          const d = getActivityDate(row);
          if (!uid || !d || d < thirtyDaysAgo || d > today) return;
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
          if (!dailyUsers.has(key)) dailyUsers.set(key, new Set());
          dailyUsers.get(key)!.add(uid);
        };

        // From views.csv and completions.csv directly
        for (const r of views) pushRow(r);
        for (const r of completions) pushRow(r);

        // From knowbys.csv we consider the *creator* as active on created_at
        for (const r of knowbys) {
          const uid = r.created_by_member_id?.trim();
          const d = parseDate(r.created_at);
          if (!uid || !d || d < thirtyDaysAgo || d > today) continue;
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
          if (!dailyUsers.has(key)) dailyUsers.set(key, new Set());
          dailyUsers.get(key)!.add(uid);
        }

        // Build 30-day trend and the overall union set
        const activeTrend: number[] = [];
        const unionUsers = new Set<string>();
        const cursor = new Date(thirtyDaysAgo);
        while (cursor <= today) {
          const key = cursor.toISOString().split("T")[0];
          const set = dailyUsers.get(key);
          if (set) set.forEach((u) => unionUsers.add(u));
          activeTrend.push(set ? set.size : 0);
          cursor.setDate(cursor.getDate() + 1);
        }
        setActiveMemberTrend(activeTrend);
        const activeMembersCount = unionUsers.size;

        // ---------- NEW KNOWBYS TREND ----------
        const dailyKnowbyMap = new Map<string, number>();
        for (const entry of knowbys) {
          const createdDate = parseDate(entry.created_at);
          if (!createdDate || createdDate < thirtyDaysAgo || createdDate > today) continue;
          const key = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate())
            .toISOString()
            .split("T")[0];
          dailyKnowbyMap.set(key, (dailyKnowbyMap.get(key) || 0) + 1);
        }
        const knowbyTrend: number[] = [];
        const c2 = new Date(thirtyDaysAgo);
        while (c2 <= today) {
          const key = c2.toISOString().split("T")[0];
          knowbyTrend.push(dailyKnowbyMap.get(key) || 0);
          c2.setDate(c2.getDate() + 1);
        }
        setNewKnowbyTrend(knowbyTrend);

        // ---------- RECENTLY EDITED TREND (using last_viewed from knowbys.csv as in your code) ----------
        const dailyEditedMap = new Map<string, number>();
        for (const entry of knowbys) {
          const lastViewed = parseDate(entry.last_viewed);
          if (!lastViewed || lastViewed < thirtyDaysAgo || lastViewed > today) continue;
          const key = new Date(lastViewed.getFullYear(), lastViewed.getMonth(), lastViewed.getDate())
            .toISOString()
            .split("T")[0];
          dailyEditedMap.set(key, (dailyEditedMap.get(key) || 0) + 1);
        }
        const editedTrend: number[] = [];
        const c3 = new Date(thirtyDaysAgo);
        while (c3 <= today) {
          const key = c3.toISOString().split("T")[0];
          editedTrend.push(dailyEditedMap.get(key) || 0);
          c3.setDate(c3.getDate() + 1);
        }
        setRecentlyEditedTrend(editedTrend);

        // ---------- BASIC STATS (existing logic) ----------
        const activeMembersFromKnowbys = new Set(
          knowbys
            .filter((d) => {
              const createdDate = parseDate(d.created_at);
              return createdDate && createdDate >= thirtyDaysAgo && createdDate <= today;
            })
            .map((d) => d.created_by_member_id)
            .filter((id) => id && id.trim() !== "")
        );

        const newKnowbys = knowbys.filter((d) => {
          const createdDate = parseDate(d.created_at);
          return createdDate && createdDate >= thirtyDaysAgo && createdDate <= today;
        });

        const recentlyEdited = knowbys.filter((d) => {
          const lastViewed = parseDate(d.last_viewed);
          return lastViewed && lastViewed >= thirtyDaysAgo && lastViewed <= today;
        });

        const unusedKnowbys = knowbys.filter((d) => {
          const views = parseInt(d.views) || 0;
          const lastViewed = parseDate(d.last_viewed);
          return views === 0 || !lastViewed || lastViewed < thirtyDaysAgo;
        });

        setStats({
          // Use the UNION count across views/completions/knowbys instead of only creators
          activeMembers: activeMembersCount,
          newKnowbys: newKnowbys.length,
          recentlyEdited: recentlyEdited.length,
          unusedKnowbys: unusedKnowbys.length,
        });
      } catch (e) {
        console.error("Error loading CSVs:", e);
      }
    })();
  }, []);

  const baseChartOptions: ApexOptions = {
    chart: { type: "area", sparkline: { enabled: true } },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 1, opacityTo: 0, stops: [0, 100] },
    },
    tooltip: { enabled: false },
    yaxis: { show: false },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Active Members */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="flex justify-between mb-2 gap-6">
          <div className="text-3xl font-bold">{stats.activeMembers}</div>
          <div className="w-24 h-6 mb-3">
            <Chart
              options={baseChartOptions}
              series={[{ name: "Active Members", data: activeMemberTrend }]}
              type="area"
              height={40}
            />
          </div>
        </div>
        <div className="text-sm font-medium mb-1">Active Members</div>
        <div className="text-xs text-muted-foreground">
          Active members in the last 30 days.
        </div>
      </div>

      {/* New Knowbys Created */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="flex justify-between mb-2 gap-6">
          <div className="text-3xl font-bold">{stats.newKnowbys}</div>
          <div className="w-24 h-6 mb-3">
            <Chart
              options={baseChartOptions}
              series={[{ name: "New Knowbys", data: newKnowbyTrend }]}
              type="area"
              height={40}
            />
          </div>
        </div>
        <div className="text-sm font-medium mb-1">New Knowbys Created</div>
        <div className="text-xs text-muted-foreground">
          Knowbys created in the last 30 days.
        </div>
      </div>

      {/* Recently Edited Knowbys */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="flex justify-between mb-2">
          <div className="text-3xl font-bold mb-2">{stats.recentlyEdited}</div>
            <div className="w-24 h-6 mb-3">
              <Chart
                options={baseChartOptions}
                series={[{ name: "New Knowbys", data: recentlyEditedTrend }]}
                type="area"
                height={40}
              />
            </div>
        </div>
        <div className="text-sm font-medium mb-1">Recently Edited Knowbys</div>
        <div className="text-xs text-muted-foreground">
          Knowbys edited in the last 30 days.
        </div>
      </div>

      {/* Unused Knowbys */}
      <div className="bg-muted/50 p-6 rounded-lg border">
        <div className="text-3xl font-bold mb-2">{stats.unusedKnowbys}</div>
        <div className="text-sm font-medium mb-1">Unused Knowbys</div>
        <div className="text-xs text-muted-foreground">
          Knowbys not used in the last 30 days.
        </div>
      </div>
    </div>
  );
}
