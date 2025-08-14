'use client'

import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";

export default function PublishedKnowbyCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    Papa.parse("/scraperpublished.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const raw = results.data as any[];

        const uniquePublished = new Set(
          raw
            .filter((d) => d.status?.trim() === "Published")
            .map((d) => d.knowby_id)
        );

        setCount(uniquePublished.size);
      }
    });
  }, []);

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{count}</CardTitle>
        <CardDescription>Published Knowbys</CardDescription>
      </CardHeader>
    </Card>
  );
}
