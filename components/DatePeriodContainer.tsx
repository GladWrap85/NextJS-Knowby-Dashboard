"use client";

import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DatePickerWithRange } from "@/components/DateRangePicker";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format, parse
} from "date-fns";
import { useDateRange } from "@/lib/DateRangeContext";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "all-time" | "range";

interface DatePeriodContainerProps {
  className?: string;
  initialPeriod?: Period;
  hideDaily?: boolean;
}

export default function DatePeriodContainer({
  className,
  initialPeriod = "weekly",
  hideDaily = true,
  children,
}: PropsWithChildren<DatePeriodContainerProps>) {
  const { dateRange, setDateRange, period, setPeriod } = useDateRange(); // ← use context period too
  const { completions, views } = useKnowbyData();

  const [rangeOpen, setRangeOpen] = useState(false);

  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const now = new Date();
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  });

  // If context hasn't chosen a period yet (first page), initialize it
  useEffect(() => {
    // only set once at mount if context has default "weekly" and you passed a different initial
    if (initialPeriod && period === "weekly" && initialPeriod !== "weekly") {
      setPeriod(initialPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTimeRange = useMemo<DateRange>(() => {
    const toDate = (s?: string) => (s ? parse(s, "dd/MM/yyyy", new Date()) : null);
    let min: Date | null = null;
    let max: Date | null = null;

    for (const r of completions) {
      const d = toDate((r as any)?.date); if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    for (const r of views) {
      const d = toDate((r as any)?.date); if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }

    if (!min || !max) {
      const now = new Date();
      return { from: startOfYear(now), to: endOfYear(now) };
    }
    return { from: min, to: max };
  }, [completions, views]);

  const computedRange = useMemo<DateRange>(() => {
    const now = new Date();
    switch (period) {
      case "daily": return { from: now, to: now };
      case "weekly": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case "monthly": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "yearly": return { from: startOfYear(now), to: endOfYear(now) };
      case "all-time": return allTimeRange;
      case "range": return customRange;
    }
  }, [period, customRange, allTimeRange]);

  // Whenever the computed range changes, push it into context (this updates URL + LS)
  useEffect(() => {
    if (computedRange?.from && computedRange?.to) {
      setDateRange(computedRange); // provider will mirror to URL/localStorage
    }
  }, [computedRange, setDateRange]);

  // If context already had a range (from URL/LS), align local customRange once
  const alignedOnce = useRef(false);
  useEffect(() => {
    if (alignedOnce.current) return;
    if (dateRange?.from && dateRange?.to) {
      setCustomRange({ from: dateRange.from, to: dateRange.to });
      alignedOnce.current = true;
    }
  }, [dateRange]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const label = useMemo(() => {
    if (!mounted || !dateRange?.from || !dateRange?.to) return "";
    return `${format(dateRange.from, "dd MMM yyyy")} → ${format(dateRange.to, "dd MMM yyyy")}`;
  }, [mounted, dateRange]);

  return (
    <div className={cn("relative mt-10 rounded-xl border bg-background shadow-md", className)}>
      {/* Tabs cradle */}
      <div className="absolute -top-9.5 right-3">
        <div className="rounded-t-2xl border border-b-0 bg-background p-0">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full">
            <TabsList className="bg-transparent rounded-t-2xl px-2 py-1 flex gap-1">
              {!hideDaily && (
                <TabsTrigger value="daily" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">
                  Daily
                </TabsTrigger>
              )}
              <TabsTrigger value="weekly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="yearly" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">
                Yearly
              </TabsTrigger>
              <TabsTrigger value="all-time" className="cursor-pointer data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-gray-300 hover:bg-card">
                All Time
              </TabsTrigger>

              <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPeriod("range")}
                    className={cn(
                      "inline-flex items-center h-7 rounded-md px-3 text-sm transition dark:text-muted-foreground text-black font-semibold",
                      period === "range"
                        ? "bg-input dark:bg-input/30 border border-input shadow-sm dark:text-white"
                        : "bg-transparent hover:bg-card"
                    )}
                    title="Custom date range"
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Range
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-2 w-auto">
                  <DatePickerWithRange
                    date={customRange}
                    onSelect={(r) => {
                      if (!r?.from || !r?.to) { setCustomRange(r ?? customRange); return; }
                      setCustomRange(r);
                      setPeriod("range");
                      // write through to context immediately (updates URL + LS)
                      setDateRange(r);
                      setRangeOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Range label inside the SAME box */}
      <div className="flex justify-end pt-2 pb-2 px-6 text-xs text-muted-foreground">
        {mounted ? label : "\u00A0"}
      </div>

      {/* Page content */}
      <div className="p-6 pt-0">
        {children}
      </div>
    </div>
  );
}
