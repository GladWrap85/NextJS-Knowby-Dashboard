"use client";

import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { CompletionData, ViewData, KnowbyMeta, TableType } from "@/src/types/knowby";

// Discriminated props: each table type enforces its row shape
type StatsTableProps =
  | { type: "active"; caption: string; data: CompletionData[] }
  | { type: "viewed"; caption: string; data: ViewData[] }
  | { type: "new"; caption: string; data: KnowbyMeta[] }
  | { type: "unused"; caption: string; data: KnowbyMeta[] };

export default function StatsTable(props: StatsTableProps) {
  const { caption } = props;

  const parsedData = (() => {
    switch (props.type) {
      case "active": {
        const completionCounts: Record<string, { member_name: string; count: number }> = {};
        props.data.forEach((d) => {
          const id = d.member_id ?? "(unknown)";
          if (!completionCounts[id]) completionCounts[id] = { member_name: d.member_name ?? "(unknown)", count: 0 };
          completionCounts[id].count += 1;
        });
        return Object.entries(completionCounts)
          .map(([member_id, info]) => ({ member_id, member_name: info.member_name, count: info.count }))
          .sort((a, b) => b.count - a.count);
      }

      case "viewed": {
        // You only have ViewData (date + knowby_name). Show most recent views.
        const toTs = (s?: string) => {
          if (!s) return 0;
          const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        // Group by knowby_name and count views, keep most recent date
        const byKnowby: Record<string, { lastDate: string; views: number }> = {};
        props.data.forEach((v) => {
          const key = v.knowby_name ?? "(unknown)";
          const cur = byKnowby[key] ?? { lastDate: "01/01/1970", views: 0 };
          const newer = toTs(v.date) > toTs(cur.lastDate) ? v.date : cur.lastDate;
          byKnowby[key] = { lastDate: newer, views: cur.views + 1 };
        });
        return Object.entries(byKnowby)
          .map(([title, info]) => ({ title, last_viewed: info.lastDate, views: info.views }))
          .sort((a, b) => {
            const aTs = toTs(a.last_viewed);
            const bTs = toTs(b.last_viewed);
            return bTs - aTs || b.views - a.views;
          });
      }

      case "new": {
        const toTs = (s: string) => {
          const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        return [...props.data].sort((a, b) => toTs(b.created_at) - toTs(a.created_at));
      }

      case "unused": {
        // Sort by fewest recent activity (example: by views asc, then oldest last_viewed)
        const toTs = (s: string) => {
          const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        return [...props.data].sort((a, b) => {
          const va = parseInt(a.views ?? "0", 10);
          const vb = parseInt(b.views ?? "0", 10);
          if (va !== vb) return va - vb; // fewer views first
          return toTs(a.last_viewed) - toTs(b.last_viewed); // older last_viewed first
        });
      }
    }
  })();

  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {props.type === "active" && (<><TableHead>Member</TableHead><TableHead className="text-right">Completions</TableHead></>)}
          {props.type === "new" && (<><TableHead>Title</TableHead><TableHead>Created By</TableHead><TableHead className="text-right">Created At</TableHead></>)}
          {props.type === "viewed" && (<><TableHead>Title</TableHead><TableHead>Last Viewed</TableHead><TableHead className="text-right">Views</TableHead></>)}
          {props.type === "unused" && (<><TableHead>Title</TableHead><TableHead>Created By</TableHead><TableHead className="text-right">Last Viewed</TableHead><TableHead className="text-right">Views</TableHead></>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parsedData.map((row: any, idx: number) => (
          <TableRow key={idx}>
            {props.type === "active" && (<><TableCell>{row.member_name}</TableCell><TableCell className="text-right">{row.count}</TableCell></>)}
            {props.type === "new" && (<><TableCell>{row.title}</TableCell><TableCell>{row.member_name}</TableCell><TableCell className="text-right">{row.created_at}</TableCell></>)}
            {props.type === "viewed" && (<><TableCell>{row.title}</TableCell><TableCell>{row.last_viewed}</TableCell><TableCell className="text-right">{row.views}</TableCell></>)}
            {props.type === "unused" && (<><TableCell>{row.title}</TableCell><TableCell>{row.member_name}</TableCell><TableCell className="text-right">{row.last_viewed}</TableCell><TableCell className="text-right">{row.views}</TableCell></>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
