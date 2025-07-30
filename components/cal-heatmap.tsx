import React, { useEffect, useRef, useState } from "react";
import CalHeatmap from "cal-heatmap";
import "cal-heatmap/cal-heatmap.css";
import Papa from "papaparse";
import dayjs from "dayjs";

// 1. Define row and calendar data types
type ViewRow = { date: string;[key: string]: any };
type CalendarDatum = { date: string; value: number };

export default function ViewsCalendarHeatmap() {
  const calRef = useRef<HTMLDivElement>(null);
  const [calendarData, setCalendarData] = useState<CalendarDatum[] | null>(null);

  // 2. Fetch and process CSV on mount
  useEffect(() => {
    fetch("/views.csv")
      .then((res) => res.text())
      .then((csv) => {
        Papa.parse<ViewRow>(csv, {
          header: true,
          complete: (results) => {
            // Aggregate view counts per day
            const dateCounts: Record<string, number> = {};
            results.data.forEach((row) => {
              if (!row.date) return; // skip malformed
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const isoDate = dayjs(row.date, "D/M/YYYY").format("YYYY-MM-DD");
              if (!dateCounts[isoDate]) dateCounts[isoDate] = 0;
              dateCounts[isoDate] += 1;
            });
            // Convert to Cal-Heatmap array format
            const calData: CalendarDatum[] = Object.entries(dateCounts).map(
              ([date, value]) => ({ date, value })
            );
            setCalendarData(calData);
          },
        });
      });
  }, []);

  // 3. Render Cal-Heatmap when data is ready
  useEffect(() => {
    if (!calendarData || !calRef.current) return;

    const cal = new CalHeatmap();
    cal.paint({
      itemSelector: calRef.current,
      data: { source: calendarData, x: "date", y: "value" },
      domain: { type: "month", padding: [0, 20, 0, 20], label: { position: "top" } },
      subDomain: { type: "xDay", width: 20, height: 20, label:"D" },
      range: 3, // Last 3 months
      scale: { color: { type: "linear", scheme: "YlGnBu" } },
      date: { start: new Date("2023-09-01") }, // adjust as needed
    });
    return () => cal.destroy();
  }, [calendarData]);

  return (
    <div>
      <div ref={calRef}></div>
      {!calendarData && <div>Loading data…</div>}
    </div>
  );
}
