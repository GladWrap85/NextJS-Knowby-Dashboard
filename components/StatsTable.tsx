"use client";

import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { CompletionData, ViewData, KnowbyMeta } from "@/src/types/knowby";

// Backward compatible: if `rows` is provided, render directly.
// Otherwise, fall back to original compute-on-render paths.
type StatsTableProps =
  | { type: "active"; caption: string; data?: CompletionData[]; rows?: Array<{ member_id: string; member_name: string; count: number }> }
  | { type: "viewed"; caption: string; data?: ViewData[]; rows?: Array<{ title: string; last_viewed: string; views: number }> }
  | { type: "new"; caption: string; data?: KnowbyMeta[]; rows?: any[] }
  | { type: "unused"; caption: string; data?: KnowbyMeta[]; rows?: any[] };

export default function StatsTable(props: StatsTableProps) {
  const { caption } = props;

  // If precomputed rows exist, use them verbatim (fast path).
  if (props.rows && props.rows.length >= 0) {
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
          {props.type === "active" &&
            (props.rows as Array<{ member_name: string; count: number }>).map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
              </TableRow>
            ))}
          {props.type === "viewed" &&
            (props.rows as Array<{ title: string; last_viewed: string; views: number }>).map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.last_viewed}</TableCell>
                <TableCell className="text-right">{row.views}</TableCell>
              </TableRow>
            ))}
          {props.type === "new" &&
            (props.rows as any[]).map((row: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.created_at}</TableCell>
              </TableRow>
            ))}
          {props.type === "unused" &&
            (props.rows as any[]).map((row: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.last_viewed}</TableCell>
                <TableCell className="text-right">{row.views}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    );
  }

  // -------- Original compute-on-render fallback (unchanged) --------
  const parsedData = (() => {
    switch (props.type) {
      case "active": {
        const completionCounts: Record<string, { member_name: string; count: number }> = {};
        (props.data ?? []).forEach((d: any) => {
          const id = d.member_id ?? "(unknown)";
          if (!completionCounts[id]) completionCounts[id] = { member_name: d.member_name ?? "(unknown)", count: 0 };
          completionCounts[id].count += 1;
        });
        return Object.entries(completionCounts)
          .map(([member_id, info]) => ({ member_id, member_name: info.member_name, count: info.count }))
          .sort((a, b) => b.count - a.count);
      }

      case "viewed": {
        const toTs = (s?: string) => {
          if (!s) return 0;
          const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        const byKnowby: Record<string, { lastDate: string; views: number }> = {};
        (props.data ?? []).forEach((v: any) => {
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
        return [...(props.data ?? [])].sort((a: any, b: any) => toTs(b.created_at) - toTs(a.created_at));
      }

      case "unused": {
        const toTs = (s: string) => {
          const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        return [...(props.data ?? [])].sort((a: any, b: any) => {
          const va = parseInt(a.views ?? "0", 10);
          const vb = parseInt(b.views ?? "0", 10);
          if (va !== vb) return va - vb;
          return toTs(a.last_viewed) - toTs(b.last_viewed);
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
