"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ResponsiveBar } from "@nivo/bar";
import { Separator } from "@/components/ui/separator";

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function getLastNDates(end: Date, n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    dates.unshift(d.toLocaleDateString("en-NZ")); // dd/mm/yyyy
  }
  return dates;
}

export default function TopKnowbyCard() {
  const [topKnowbyName, setTopKnowbyName] = useState("");
  const [barData, setBarData] = useState<any[]>([]);

  useEffect(() => {
    Papa.parse("/completions.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];

        const latestDate = new Date();
        const last10Days = getLastNDates(latestDate, 10);
        const counts: Record<string, Record<string, number>> = {};
        const nameMap: Record<string, string> = {};

        data.forEach((entry) => {
          const date = parseDate(entry.date);
          const dateStr = date.toLocaleDateString("en-NZ");
          const knowby = entry.knowby_id;
          const knowbyName = entry.knowby_name;

          if (!last10Days.includes(dateStr)) return;

          if (!counts[knowby]) {
            counts[knowby] = {};
            nameMap[knowby] = knowbyName;
          }

          counts[knowby][dateStr] = (counts[knowby][dateStr] || 0) + 1;
        });

        // Find top knowby
        let topKnowby = "";
        let maxTotal = 0;

        for (const [id, daily] of Object.entries(counts)) {
          const total = Object.values(daily).reduce((a, b) => a + b, 0);
          if (total > maxTotal) {
            maxTotal = total;
            topKnowby = id;
          }
        }

        if (!topKnowby) return;

        const dailyCounts = last10Days.map((d) => ({
          date: d,
          Completions: counts[topKnowby]?.[d] || 0,
        }));

        setTopKnowbyName(nameMap[topKnowby]);
        setBarData(dailyCounts);
      },
    });
  }, []);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Top Performing Knowby</CardTitle>
        <CardDescription className="font-medium mt-1">{topKnowbyName}</CardDescription>
      </CardHeader>
      <Separator className="my-4" />
      <CardContent className="h-[200px]">
        <ResponsiveBar
          data={barData}
          keys={["Completions"]}
          indexBy="date"
          margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
          padding={0.3}
          colors={{ scheme: "category10" }}
          axisBottom={{
            tickRotation: -30,
            tickSize: 5,
            tickPadding: 5,
          }}
          axisLeft={{ tickSize: 5, tickPadding: 5 }}
          enableLabel={false}
          tooltip={({ id, value, indexValue }) => (
            <div className="p-2 bg-white dark:bg-black border rounded text-xs">
              <strong>{indexValue}</strong>: {value} {id}
            </div>
          )}
          borderRadius={4}
        />
      </CardContent>
    </Card>
  );
}
