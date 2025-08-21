import React, { useEffect, useRef, useState } from "react";
import CalHeatmap from "cal-heatmap";
import "cal-heatmap/cal-heatmap.css";
import Papa from "papaparse";
import dayjs from "dayjs";
import { useDarkMode } from "./NivoWrapper";
import Tooltip from 'cal-heatmap/plugins/Tooltip';

type Row = { date?: string;[k: string]: any };
type CalendarDatum = { date: string; value: number };

function quarterStart(d: Date) {
  const m = d.getMonth();            // 0..11
  const q0 = Math.floor(m / 3) * 3;  // 0,3,6,9
  return new Date(d.getFullYear(), q0, 1);
}
function previousQuarterStart(d: Date) {
  const qs = quarterStart(d);
  return new Date(qs.getFullYear(), qs.getMonth() - 3, 1);
}
function quarterLabel(date: Date) {
  const m = date.getMonth();
  const q = Math.floor(m / 3) + 1; // 1..4
  return `Q${q} ${date.getFullYear()}`;
}
// Strictly convert "dd/mm/yyyy" → "yyyy-mm-dd". No ambiguity.
const toISO = (raw?: string | null) => {
  if (!raw) return null;
  const s = String(raw).trim();

  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    const d = dd.padStart(2, "0");
    const m = mm.padStart(2, "0");
    return `${yyyy}-${m}-${d}`; // ISO for cal-heatmap
  }

  // already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // anything else: ignore
  return null;
};

const parseCsv = (text: string) =>
  new Promise<Row[]>((resolve) =>
    Papa.parse<Row>(text, {
      header: true,
      skipEmptyLines: "greedy",
      complete: ({ data }) => resolve(data),
    })
  );

export default function ViewsCalendarHeatmap() {
  const refCurrent = useRef<HTMLDivElement>(null);
  const refLast = useRef<HTMLDivElement>(null);
  const [calendarData, setCalendarData] = useState<CalendarDatum[] | null>(null);
  const isDark = useDarkMode(); // your hook

  // Keep your global dark class toggle if you need it elsewhere
  useEffect(() => {
    document.documentElement.classList.toggle("dark", !!isDark);
  }, [isDark]);

  // Load and aggregate both CSVs into a single {date -> count} map
  useEffect(() => {
    (async () => {
      const [viewsText, compsText] = await Promise.all([
        fetch("/scraperviews.csv").then((r) => r.text()),
        fetch("/scrapercompletions.csv").then((r) => r.text()),
      ]);
      const [viewsRows, compsRows] = await Promise.all([parseCsv(viewsText), parseCsv(compsText)]);

      const counts: Record<string, number> = {};
      const add = (rows: Row[]) => {
        rows.forEach((row) => {
          const iso = toISO(row.date);
          if (iso) counts[iso] = (counts[iso] ?? 0) + 1;
        });
      };
      add(viewsRows);
      add(compsRows);

      const combined: CalendarDatum[] = Object.entries(counts)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      setCalendarData(combined);
    })();
  }, []);

  // Paint both quarter heatmaps
  useEffect(() => {
    if (!calendarData || calendarData.length === 0) return;
    if (!refCurrent.current || !refLast.current) return;

    const today = new Date();
    const startCurrentQ = quarterStart(today);
    const startLastQ = previousQuarterStart(today);
    const maxVal = calendarData.reduce((m, d) => Math.max(m, d.value), 1);

    const common = {
      data: { source: calendarData, x: "date", y: "value" },
      verticalOrientation: false,
      range: 3,
      domain: {
        type: "month",
        padding: [0, 10, 0, 10],
        label: { position: "top" },
        dynamicDimension: false,
      },
      subDomain: {
        type: "xDay",
        width: 20,
        height: 20,
        gutter: 2,
        radius: 4,
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

    // Tooltip plugin (only shows on days that have data)
    const plugins = [
      [
        Tooltip,
        {
          text: (date: Date, value?: number) => {
            if (value == null) return null; // hide for empty cells
            const fullDate = dayjs(date).format("dddd, D MMMM YYYY");
            const total = value.toLocaleString();
            // Tiny, neutral markup; inherits your theme colors
            return `
            <div style="font-size:12px; line-height:1.2;">
              <div style="opacity:.75;">${fullDate}</div>
              <div style="font-weight:600;">${total} total</div>
            </div>
          `;
          },
          // Optional niceties:
          // delay: 0,
          // offset: { x: 8, y: 8 },
        } as any,
      ],
    ] as const;

    const calCurr = new CalHeatmap();
    const calLast = new CalHeatmap();

    calCurr.paint(
      {
        itemSelector: refCurrent.current!,
        date: { start: startCurrentQ },
        ...common,
      },
      plugins
    );
    calLast.paint(
      {
        itemSelector: refLast.current!,
        date: { start: startLastQ },
        ...common,
      },
      plugins
    );

    return () => {
      calCurr.destroy();
      calLast.destroy();
    };
  }, [calendarData, isDark]);

  const today = new Date();
  const startCurrentQ = quarterStart(today);
  const startLastQ = previousQuarterStart(today);

  return (
    <div className="flex flex-col w-fit">
      <div className="flex flex-col items-center mb-2">
        <div className="text-base font-semibold">{quarterLabel(startCurrentQ)}</div>
        <div ref={refCurrent} className="overflow-x-auto p-1 rounded-lg shadow-lg border" />
      </div>

      <div className="flex flex-col items-center">
        <div className="text-base font-semibold">{quarterLabel(startLastQ)}</div>
        <div ref={refLast} className="overflow-x-auto p-1 rounded-lg shadow-lg border" />
      </div>

      {!calendarData && <div className="mt-2 text-sm opacity-70">Loading data…</div>}
    </div>
  );
}
