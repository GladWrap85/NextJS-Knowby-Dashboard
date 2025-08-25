"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CalHeatmap from "cal-heatmap";
import "cal-heatmap/cal-heatmap.css";
import Tooltip from "cal-heatmap/plugins/Tooltip";
import dayjs from "dayjs";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { useDarkMode } from "./NivoWrapper";

// ---------- helpers (same as yours) ----------
type Row = { date?: string;[k: string]: any };
type CalendarDatum = { date: string; value: number };

function quarterStart(d: Date) { const m = d.getMonth(); const q0 = Math.floor(m / 3) * 3; return new Date(d.getFullYear(), q0, 1); }
function previousQuarterStart(d: Date) { const qs = quarterStart(d); return new Date(qs.getFullYear(), qs.getMonth() - 3, 1); }
function quarterLabel(date: Date) { const m = date.getMonth(); const q = Math.floor(m / 3) + 1; return `Q${q} ${date.getFullYear()}`; }
// Strictly convert "dd/mm/yyyy" → "yyyy-mm-dd". No ambiguity.
const toISO = (raw?: string | null) => {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) { const [, dd, mm, yyyy] = m1; return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

export default function QuarterlyViewsHeatmapCompact() {
  const refCurrent = useRef<HTMLDivElement>(null);
  const refLast = useRef<HTMLDivElement>(null);
  const [calendarData, setCalendarData] = useState<CalendarDatum[] | null>(null);
  const isDark = useDarkMode();

  // ✅ provider data
  const { views, completions, status } = useKnowbyData() as {
    views: Row[]; completions: Row[]; status: "loading" | "ready" | "refreshing" | "error";
  };

  // aggregate → {date -> count}
  useEffect(() => {
    if (!(status === "ready" || status === "refreshing")) return;
    const counts: Record<string, number> = {};
    const add = (rows: Row[]) => rows.forEach((r) => {
      if (!r) return;
      const allEmpty = Object.values(r).every((v) => String(v ?? "").trim() === "");
      if (allEmpty) return;
      const iso = toISO(r.date);
      if (iso) counts[iso] = (counts[iso] ?? 0) + 1;
    });
    add(views ?? []); add(completions ?? []);
    const combined = Object.entries(counts).map(([date, value]) => ({ date, value }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    setCalendarData(combined);
  }, [views, completions, status]);

  // paint two compact calendars
  useEffect(() => {
    if (!calendarData?.length || !refCurrent.current || !refLast.current) return;

    const today = new Date();
    const startCurrentQ = quarterStart(today);
    const startLastQ = previousQuarterStart(today);
    const maxVal = calendarData.reduce((m, d) => Math.max(m, d.value), 1);

    const common = {
      data: { source: calendarData, x: "date", y: "value" },
      verticalOrientation: false,
      range: 3, // exactly one quarter
      domain: { type: "month", padding: [0, 6, 0, 6], label: { position: "top" }, dynamicDimension: false },
      subDomain: {
        type: "xDay",
        width: 18,      // smaller cells
        height: 18,
        gutter: 1,      // tighter grid
        radius: 4,      // small rounding
        label: (ts: number) => dayjs(ts).format("D"),
      },
      scale: {
        color: {
          type: "linear",
          domain: [1, maxVal],
          range: isDark ? ["#1f2a44", "#60a5fa"] : ["#e6efff", "#1d4ed8"],
        },
      },
      theme: isDark ? "dark" : "light",
    } as const;

    const plugins = [[Tooltip, {
      text: (date: Date, value?: number) =>
        value == null ? null :
          `<div style="font-size:11px;line-height:1.2;">
            <div style="opacity:.75;">${dayjs(date).format("D MMM YYYY")}</div>
            <div style="font-weight:600;">${value.toLocaleString()} total</div>
          </div>`
    } as any]] as const;

    const calCurr = new CalHeatmap();
    const calLast = new CalHeatmap();

    calCurr.paint({ itemSelector: refCurrent.current!, date: { start: startCurrentQ }, ...common }, plugins);
    calLast.paint({ itemSelector: refLast.current!, date: { start: startLastQ }, ...common }, plugins);

    return () => { calCurr.destroy(); calLast.destroy(); };
  }, [calendarData, isDark]);

  // compact legend values
  const legendColors = useMemo(() => (isDark ? ["#1f2a44", "#60a5fa"] : ["#e6efff", "#1d4ed8"]), [isDark]);
  const legendMax = useMemo(() => (calendarData?.length ? Math.max(1, ...calendarData.map(d => d.value)) : 1), [calendarData]);

  const now = new Date();
  const startCurrentQ = quarterStart(now);
  const startLastQ = previousQuarterStart(now);

  return (
    <section className="rounded-lg p-3 w-full max-w-[980px]">


      <div className="flex items-start gap-3">
        {/* heatmaps column */}
        <div className="flex flex-col w-full gap-2">
          <div className="rounded-md border p-2">
            <div className="text-sm font-medium mb-1">{quarterLabel(startCurrentQ)}</div>
            <div ref={refCurrent} className="overflow-x-auto" />
          </div>
          <div className="rounded-md border p-2">
            <div className="text-sm font-medium mb-1">{quarterLabel(startLastQ)}</div>
            <div ref={refLast} className="overflow-x-auto" />
          </div>
        </div>

        {/* super-compact legend */}
        <div className="hidden sm:flex flex-col items-center select-none min-w-[34px]">
          <div className="text-[10px] mb-0.5 opacity-80">High</div>
          <div
            aria-hidden
            className="rounded border"
            style={{
              width: 10,
              height: 120,
              background: `linear-gradient(to bottom, ${legendColors[1]}, ${legendColors[0]})`,
            }}
          />
          <div className="text-[10px] mt-0.5 opacity-80">Low</div>
          <div className="mt-1 text-[9px] tabular-nums opacity-70">1 → {legendMax}</div>
        </div>
      </div>
    </section>
  );
}
