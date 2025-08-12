import React, { useEffect, useRef, useState } from "react";
import CalHeatmap from "cal-heatmap";
import "cal-heatmap/cal-heatmap.css";
import Papa from "papaparse";
import dayjs from "dayjs";
import { useDarkMode } from "./NivoWrapper";

type ViewRow = { date: string; [key: string]: any };
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

export default function ViewsCalendarHeatmap() {
  const refCurrent = useRef<HTMLDivElement>(null);
  const refLast = useRef<HTMLDivElement>(null);
  const [calendarData, setCalendarData] = useState<CalendarDatum[] | null>(null);
  const isDark = useDarkMode(); // Assuming this hook gives the dark mode status

  // Toggle dark mode on the body
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark"); // Add 'dark' class to the HTML tag
    } else {
      document.documentElement.classList.remove("dark"); // Remove it on light mode
    }
  }, [isDark]);

  // Load and aggregate CSV data
  useEffect(() => {
    fetch("/views.csv")
      .then((res) => res.text())
      .then((csv) => {
        Papa.parse<ViewRow>(csv, {
          header: true,
          complete: ({ data }) => {
            const counts: Record<string, number> = {};
            data.forEach((row) => {
              if (!row.date) return;
              const iso = dayjs(row.date.trim(), ["D/M/YYYY", "DD/MM/YYYY"], true)
                .format("YYYY-MM-DD");
              if (iso === "Invalid Date") return;
              counts[iso] = (counts[iso] ?? 0) + 1;
            });
            // Normalize data values between 0-100 for color scale
            const maxVal = Math.max(...Object.values(counts));
            setCalendarData(
              Object.entries(counts).map(([date, value]) => ({
                date,
                value: (value / maxVal) * 100, // Normalize value to 0-100 range
              }))
            );
          },
        });
      });
  }, []);

  // Paint both quarter heatmaps
  useEffect(() => {
    if (!calendarData || calendarData.length === 0) return;
    if (!refCurrent.current || !refLast.current) return;

    const today = new Date();
    const startCurrentQ = quarterStart(today);
    const startLastQ = previousQuarterStart(today);
    
    const common = {
      data: { source: calendarData, x: "date", y: "value" },
      verticalOrientation: false,
      range: 3, // exactly one quarter
      domain: { type: "month", padding: [0, 10, 0, 10], label: { position: "top" }, dynamicDimension: false },
      subDomain: { type: "xDay", width: 20, height: 20, gutter: 2, label: (ts: number) => dayjs(ts).format("D") },
      scale: { 
        color: { 
          type: "linear", 
          domain: [0, 100], 
          range: isDark ? ["#ffffff", "#0000ff"] : ["#ffffff", "#0000ff"] 
        } 
      },
    } as const;

    const calCurr = new CalHeatmap();
    const calLast = new CalHeatmap();

    calCurr.paint({ itemSelector: refCurrent.current, date: { start: startCurrentQ }, ...common });
    calLast.paint({ itemSelector: refLast.current, date: { start: startLastQ }, ...common });

    return () => {
      calCurr.destroy();
      calLast.destroy();
    };
  }, [calendarData, isDark]);

  const today = new Date();
  const startCurrentQ = quarterStart(today);
  const startLastQ = previousQuarterStart(today);

  return (
    <div className="flex flex-col">
      <div>
        <div className="text-lg font-semibold mb-2">{quarterLabel(startCurrentQ)}</div>
        <div ref={refCurrent} style={{ width: "100%", minWidth: 720 }} className="overflow-x-auto" />
      </div>

      <div>
        <div className="text-lg font-semibold mb-2">{quarterLabel(startLastQ)}</div>
        <div ref={refLast} style={{ width: "100%", minWidth: 720 }} className="overflow-x-auto" />
      </div>

      {!calendarData && <div>Loading data…</div>}
    </div>
  );
}
