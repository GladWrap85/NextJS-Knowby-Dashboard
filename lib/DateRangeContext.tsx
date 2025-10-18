"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "all-time" | "range";

type Ctx = {
  dateRange: DateRange | undefined;
  setDateRange: (r: DateRange | undefined, opts?: { updateUrl?: boolean }) => void;
  period: Period;
  setPeriod: (p: Period) => void;
};

const DateRangeCtx = createContext<Ctx | null>(null);

const LS_KEY_RANGE = "knowby:dateRange";
const LS_KEY_PERIOD = "knowby:period";

// --- helpers: ISO for URL (yyyy-mm-dd) ---
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12)); // midday UTC to avoid TZ rollover
};

function readRangeFromLocalStorage(): DateRange | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY_RANGE);
    if (!raw) return undefined;
    const obj = JSON.parse(raw);
    const from = obj?.from ? new Date(obj.from) : undefined;
    const to = obj?.to ? new Date(obj.to) : undefined;
    if (from && to) return { from, to };
  } catch { }
  return undefined;
}

function saveRangeToLocalStorage(r?: DateRange) {
  try {
    if (!r?.from || !r?.to) {
      localStorage.removeItem(LS_KEY_RANGE);
      return;
    }
    localStorage.setItem(
      LS_KEY_RANGE,
      JSON.stringify({ from: r.from.toISOString(), to: r.to.toISOString() })
    );
  } catch { }
}

function readPeriodFromLocalStorage(): Period | undefined {
  try {
    const p = localStorage.getItem(LS_KEY_PERIOD) as Period | null;
    return p ?? undefined;
  } catch { }
  return undefined;
}

function savePeriodToLocalStorage(p: Period) {
  try {
    localStorage.setItem(LS_KEY_PERIOD, p);
  } catch { }
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bootstrapped = useRef(false);

  const [dateRange, _setDateRange] = useState<DateRange | undefined>(undefined);
  const [period, _setPeriod] = useState<Period>("weekly");

  // Initialize from URL -> localStorage -> defaults
  useEffect(() => {
    if (bootstrapped.current) return;

    // 1) URL has ?from=yyyy-mm-dd&to=yyyy-mm-dd
    const fromQ = searchParams.get("from");
    const toQ = searchParams.get("to");
    if (fromQ && toQ) {
      const f = fromISO(fromQ);
      const t = fromISO(toQ);
      if (f && t) _setDateRange({ from: f, to: t });
    } else {
      // 2) localStorage
      const lsRange = readRangeFromLocalStorage();
      if (lsRange) _setDateRange(lsRange);
    }

    const lsPeriod = readPeriodFromLocalStorage();
    if (lsPeriod) _setPeriod(lsPeriod);

    bootstrapped.current = true;
  }, [searchParams]);

  // Keep localStorage in sync
  useEffect(() => {
    saveRangeToLocalStorage(dateRange);
  }, [dateRange]);
  useEffect(() => {
    savePeriodToLocalStorage(period);
  }, [period]);

  const setDateRange = (r: DateRange | undefined, opts?: { updateUrl?: boolean }) => {
    _setDateRange(r);

    // optionally reflect in URL (replace to avoid history spam)
    if (opts?.updateUrl !== false) {
      const params = new URLSearchParams(searchParams.toString());
      if (r?.from && r?.to) {
        params.set("from", toISO(r.from));
        params.set("to", toISO(r.to));
      } else {
        params.delete("from");
        params.delete("to");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const setPeriod = (p: Period) => {
    _setPeriod(p);
  };

  const value = useMemo(
    () => ({ dateRange, setDateRange, period, setPeriod }),
    [dateRange, period]
  );

  return <DateRangeCtx.Provider value={value}>{children}</DateRangeCtx.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeCtx);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
