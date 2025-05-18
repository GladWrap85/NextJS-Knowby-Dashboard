"use client";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TableDemo() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    Papa.parse("./completions.csv", {
      download: true,
      header: true,
      complete: (results) => {
        const raw = results.data;
        const counts: Record<string, { member_name: string; count: number }> = {};

        raw.forEach((entry: any) => {
          const id = entry.member_id;
          if (!counts[id]) {
            counts[id] = { member_name: entry.member_name, count: 0 };
          }
          counts[id].count += 1;
        });

        const result = Object.entries(counts).map(([id, info]) => ({
          member_id: id,
          member_name: info.member_name,
          count: info.count,
        }));

        result.sort((a, b) => b.count - a.count);

        setData(result);
      },
    });
  }, []);

  return (
    <Table>
      <TableCaption>Top members by completions.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead className="text-right">Completions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.member_id}>
            <TableCell>{row.member_name}</TableCell>
            <TableCell className="text-right">{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
