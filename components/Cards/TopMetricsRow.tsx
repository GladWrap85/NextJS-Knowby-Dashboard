"use client";

import { Card } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
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

function parseCsvDate(ds?: string): Date | null {
  if (!ds) return null;
  // CSV dates are dd/MM/yyyy
  return parse(ds, "dd/MM/yyyy", new Date());
}

function inRange(d: Date | null, from: Date, to: Date) {
  if (!d) return false;
  const start = new Date(from.setHours(0, 0, 0, 0));
  const end = new Date(to.setHours(23, 59, 59, 999));
  return isWithinInterval(d, { start, end });
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

function DeltaBadge({
  delta,
  isRate = false,
}: {
  delta: number | null;
  isRate?: boolean;
}) {
  if (delta == null) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        —
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const txt =
    (isRate ? Math.abs(delta).toFixed(2) : Math.abs(delta).toFixed(2)) + "%";
  return (
    <span
      className={
        "flex items-center gap-1 text-xs px-1 rounded p-0.5 " +
        (up
          ? "text-green-600 bg-green-500/30 dark:text-green-500 dark:bg-emerald-950"
          : "text-red-600 bg-rose-500/30 dark:text-red-500 dark:bg-rose-950")
      }
      title={isRate ? `Δ completion rate: ${txt}` : `Δ vs prev: ${txt}`}
    >
      <Icon className="h-3 w-3" />
      {txt}
    </span>
  );
}

export default function TopMetricsRow({ selectedDateRange }: Props) {
  const { completions, views, status } = useKnowbyData();

  // Guard: if we don't have a range yet, show zeros
  const now = new Date();
  const from = selectedDateRange?.from ?? now;
  const to = selectedDateRange?.to ?? now;

  // Previous period of the same length (ends the day before "from")
  const spanDays = differenceInCalendarDays(to, from) + 1;
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, spanDays - 1);

  // --- Aggregate current period ---
  const {
    activeMembers,
    knowbys,
    vCount,
    cCount,
    compRate,
    prevActiveMembers,
    prevKnowbys,
    prevVCount,
    prevCCount,
    prevCompRate,
  } = useMemo(() => {
    // current
    let v = 0,
      c = 0;
    const memberSet = new Set<string>();
    const knowbySet = new Set<string>();

    for (const row of views) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, from, to)) {
        v += 1;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) memberSet.add(mid);
        const kid = (row as any)?.knowby_id as string | undefined;
        if (kid) knowbySet.add(kid);
      }
    }
    for (const row of completions) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, from, to)) {
        c += 1;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) memberSet.add(mid); // union with views members
        const kid = (row as any)?.knowby_id as string | undefined;
        if (kid) knowbySet.add(kid); // union with views knowbys
      }
    }
    const rate = v > 0 ? (c / v) * 100 : 0;

    // previous
    let pv = 0,
      pc = 0;
    const pmemberSet = new Set<string>();
    const pknowbySet = new Set<string>();

    for (const row of views) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, prevFrom, prevTo)) {
        pv += 1;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) pmemberSet.add(mid);
        const kid = (row as any)?.knowby_id as string | undefined;
        if (kid) pknowbySet.add(kid);
      }
    }
    for (const row of completions) {
      const d = parseCsvDate((row as any)?.date);
      if (inRange(d, prevFrom, prevTo)) {
        pc += 1;
        const mid = (row as any)?.member_id as string | undefined;
        if (mid) pmemberSet.add(mid);
        const kid = (row as any)?.knowby_id as string | undefined;
        if (kid) pknowbySet.add(kid);
      }
    }
    const prate = pv > 0 ? (pc / pv) * 100 : 0;

    return {
      activeMembers: memberSet.size,
      knowbys: knowbySet.size,
      vCount: v,
      cCount: c,
      compRate: rate,
      prevActiveMembers: pmemberSet.size,
      prevKnowbys: pknowbySet.size,
      prevVCount: pv,
      prevCCount: pc,
      prevCompRate: prate,
    };
  }, [views, completions, from, to, prevFrom, prevTo]);

  // Deltas: percent change for counts; percentage-point change for rate (but we still render as % for badge consistency)
  const deltaMembers =
    activeMembers === 0 && prevActiveMembers === 0
      ? null
      : prevActiveMembers > 0
        ? ((activeMembers - prevActiveMembers) / prevActiveMembers) * 100
        : 100; // from 0 → up
  const deltaKnowbys =
    knowbys === 0 && prevKnowbys === 0
      ? null
      : prevKnowbys > 0
        ? ((knowbys - prevKnowbys) / prevKnowbys) * 100
        : 100;
  const deltaViews =
    vCount === 0 && prevVCount === 0
      ? null
      : prevVCount > 0
        ? ((vCount - prevVCount) / prevVCount) * 100
        : 100;
  const deltaCompletions =
    cCount === 0 && prevCCount === 0
      ? null
      : prevCCount > 0
        ? ((cCount - prevCCount) / prevCCount) * 100
        : 100;
  const deltaRate =
    compRate === 0 && prevCompRate === 0 ? null : compRate - prevCompRate; // percentage points

  const isLoading = status === "loading";

  // Ghosted while loading
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 rounded-3xl"
          >
            {/* icon circle */}
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            {/* label + value */}
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

      {/* Knowbys */}
      <Card className="flex flex-row items-center p-4 bg-card shadow-xl/2 dark:shadow-lg dark:shadow-gray-900/50 gap-3 border-0 border-b-indigo-500/50 border-b-2 rounded-3xl">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-500">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs text-muted-foreground">Knowbys</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums dark:text-white">
              {knowbys.toLocaleString()}
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
            <DeltaBadge delta={deltaRate ?? null} isRate />
          </div>
        </div>
      </Card>
    </div>
  );
}
