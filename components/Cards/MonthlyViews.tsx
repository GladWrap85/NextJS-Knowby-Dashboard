'use client'

import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";

function parseDate(dateStr: string) {
  // Format: DD/MM/YYYY
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

export default function MonthlyViewsCard() {
  const [currentViews, setCurrentViews] = useState(0);
  const [percentChange, setPercentChange] = useState<number | null>(null);

  useEffect(() => {
    Papa.parse("/views.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const raw = results.data as any[];
        const now = new Date();
        const thisMonth = now.getMonth(); // 0-indexed
        const thisYear = now.getFullYear();
        const dayOfMonth = now.getDate();

        let currentMonthCount = 0;
        let previousMonthCount = 0;

        raw.forEach((entry) => {
          if (!entry.date) return;

          const date = parseDate(entry.date);
          const isBeforeCutoff = date.getDate() <= dayOfMonth;

          if (isBeforeCutoff && date.getFullYear() === thisYear && date.getMonth() === thisMonth) {
            currentMonthCount++;
          } else if (
            isBeforeCutoff &&
            date.getFullYear() === thisYear &&
            date.getMonth() === thisMonth - 1
          ) {
            previousMonthCount++;
          } else if (
            isBeforeCutoff &&
            thisMonth === 0 && // January
            date.getFullYear() === thisYear - 1 &&
            date.getMonth() === 11
          ) {
            previousMonthCount++;
          }
        });

        setCurrentViews(currentMonthCount);

        if (previousMonthCount > 0) {
          const percent = ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100;
          setPercentChange(Math.round(percent));
        } else {
          setPercentChange(null);
        }
      },
    });
  }, []);

  return (
    <Card className = "border-0 shadow-none">
      <CardHeader>
        <CardTitle>{currentViews} views this month</CardTitle>
        <CardDescription>
          {percentChange !== null
            ? `${percentChange > 0 ? '+' : ''}${percentChange}% vs same time last month`
            : 'No data from last month'}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
