// src/components/Cards/TopMetricsRow.tsx
"use client";

import { Card } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  BookOpen,
  CheckCheck,
  Eye,
  Percent,
  User,
} from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { DateRange } from "react-day-picker";
import {
  parse,
  isWithinInterval,
  differenceInCalendarDays,
  subDays,
} from "date-fns";
import { useMemo } from "react";

type Props = {
  selectedDateRange: DateRange | undefined;
};

/** Helper: parse dd/MM/yyyy (used for views/completions only) */
function parseCsvDate(ds?: string): Date | null {
  if (!ds) return null;
  return parse(ds, "dd/MM/yyyy", new Date());
}

function inRange(d: Date | null, from: Date, to: Date) {
  if (!d) return false;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return isWithinInterval(d, { start, end });
}

/** Helper for percentage formatting */
function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

/** Count knowbys created between two dates */
function countKnowbysInRange(
  list: { createdTs?: number }[],
  from: Date,
  to: Date
) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const s = start.getTime();
  const e = end.getTime();
  let n = 0;
  for (const k of list) {
    if (k.createdTs != null && k.createdTs >= s && k.createdTs <= e) n++;
  }
  return n;
}

/** Delta badge for comparison % changes */
function DeltaBadge({ delta, isRate = false }: { delta: number | null; isRate?: boolean }) {
  if (delta == null || isNaN(delta)) delta = 0;

  const up = delta > 0;
  const down = delta < 0;
  const neutral = delta === 0;

  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const txt = `${Math.abs(delta).toFixed(2)}%`;

  const colorClass = neutral
    ? "text-muted-foreground bg-muted"
    : up
      ? "text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950"
      : "text-red-600 bg-rose-500/30 dark:text-red-500 dark:bg-rose-950";

  return (
    <span
      className={`flex items-center gap-1 text-xs px-1 rounded p-0.5 ${colorClass}`}
      title={isRate ? `Δ completion rate: ${txt}` : `Δ vs prev: ${txt}`}
    >
      <Icon className="h-3 w-3" />
      {txt}
    </span>
  );
}

/** Main metrics row */
export default function TopMetricsRow({ selectedDateRange }: Props) {
  const { completions, views, knowbys, status } = useKnowbyData();

  const now = new Date();
  const from = selectedDateRange?.from ?? now;
  const to = selectedDateRange?.to ?? now;

  // Previous period of same span (ending just before current)
  const spanDays = differenceInCalendarDays(to, from) + 1;
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, spanDays - 1);

  const {
    activeMembers,
    knowbysCreated,
    vCount,
    cCount,
    compRate,
    prevActiveMembers,
    prevKnowbysCreated,
    prevVCount,
    prevCCount,
    prevCompRate,
  } = useMemo(() => {
    // --- Current period ---
    let v = 0,
      c = 0;
    const memberSet = new Set<string>();

    for (const row of views) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, from, to)) {
        v++;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) memberSet.add(mid);
      }
    }

    for (const row of completions) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, from, to)) {
        c++;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) memberSet.add(mid);
      }
    }

    const rate = v > 0 ? (c / v) * 100 : 0;

    // Knowbys created in current range
    const kCurrent = countKnowbysInRange(knowbys ?? [], from, to);

    // --- Previous period ---
    let pv = 0,
      pc = 0;
    const pmemberSet = new Set<string>();

    for (const row of views) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, prevFrom, prevTo)) {
        pv++;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) pmemberSet.add(mid);
      }
    }

    for (const row of completions) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, prevFrom, prevTo)) {
        pc++;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) pmemberSet.add(mid);
      }
    }

    const prate = pv > 0 ? (pc / pv) * 100 : 0;

    // Knowbys created in previous range
    const kPrev = countKnowbysInRange(knowbys ?? [], prevFrom, prevTo);

    return {
      activeMembers: memberSet.size,
      knowbysCreated: kCurrent,
      vCount: v,
      cCount: c,
      compRate: rate,
      prevActiveMembers: pmemberSet.size,
      prevKnowbysCreated: kPrev,
      prevVCount: pv,
      prevCCount: pc,
      prevCompRate: prate,
    };
  }, [views, completions, knowbys, from, to, prevFrom, prevTo]);

  // Deltas (% change vs previous)
  const deltaMembers =
    activeMembers === 0 && prevActiveMembers === 0
      ? 0
      : prevActiveMembers > 0
        ? ((activeMembers - prevActiveMembers) / prevActiveMembers) * 100
        : 100;

  const deltaKnowbys =
    knowbysCreated === 0 && prevKnowbysCreated === 0
      ? 0
      : prevKnowbysCreated > 0
        ? ((knowbysCreated - prevKnowbysCreated) / prevKnowbysCreated) * 100
        : 100;

  const deltaViews =
    vCount === 0 && prevVCount === 0
      ? 0
      : prevVCount > 0
        ? ((vCount - prevVCount) / prevVCount) * 100
        : 100;

  const deltaCompletions =
    cCount === 0 && prevCCount === 0
      ? 0
      : prevCCount > 0
        ? ((cCount - prevCCount) / prevCCount) * 100
        : 100;

  const deltaRate =
    compRate === 0 && prevCompRate === 0 ? 0 : compRate - prevCompRate;


  if (status === "loading") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 rounded-3xl"
          >
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            <div className="flex flex-col justify-center gap-2 flex-1">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
      {/* Active Members */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-teal-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-600/20 text-teal-500">
          <User className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Active Members</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {activeMembers.toLocaleString()}
            </span>
            <DeltaBadge delta={deltaMembers} />
          </div>
        </div>
      </Card>

      {/* Knowbys (created within range) */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-indigo-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-500">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Knowbys</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {knowbysCreated.toLocaleString()}
            </span>
            <DeltaBadge delta={deltaKnowbys} />
          </div>
        </div>
      </Card>

      {/* Views */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-blue-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600/20 text-blue-500">
          <Eye className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Views</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {vCount.toLocaleString()}
            </span>
            <DeltaBadge delta={deltaViews} />
          </div>
        </div>
      </Card>

      {/* Completions */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-green-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600/20 text-green-500">
          <CheckCheck className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Completions</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {cCount.toLocaleString()}
            </span>
            <DeltaBadge delta={deltaCompletions} />
          </div>
        </div>
      </Card>

      {/* Completion Rate */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-purple-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600/20 text-purple-500">
          <Percent className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Completion Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {pct(compRate || 0)}
            </span>
            <DeltaBadge delta={deltaRate} isRate />
          </div>
        </div>
      </Card>
    </div>
  );
}
