// src/contexts/KnowbyDataProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Papa from "papaparse";
import { showRefreshNotification } from "./dataChangeDetection";

/** Data source selector */
export type DataSource = "sample" | "real";
type Status = "loading" | "ready" | "refreshing" | "error";

/** ---- Row types mapped to your CSV shapes ----
 * Keep optional fields optional to match real-world CSV variance.
 * Dates remain as dd/MM/yyyy (original), but we also attach parsed helpers.
 */
export interface CompletionData {
  organisation_name?: string;
  knowby_id: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string;                 // dd/MM/yyyy (original)
  time?: string;                // HH:mm:ss (optional)
  datetime?: string;            // ISO string (optional, if you ever add it)
  parsedDateTime?: Date;        // added: parsed once (date+time)
  ts?: number;                  // added: parsedDateTime.getTime()
  ymd?: string;                 // added: 'YYYY-MM-DD' key
}

export interface ViewData {
  organisation_name?: string;
  knowby_id?: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string;                 // dd/MM/yyyy (original)
  time?: string;                // HH:mm:ss (optional)
  datetime?: string;            // ISO string (optional)
  parsedDateTime?: Date;        // added
  ts?: number;                  // added
  ymd?: string;                 // added
}

/** Endpoints for each mode (unchanged) */
export const ENDPOINTS: Record<DataSource, { completions: string; views: string }> = {
  sample: { completions: "/completions.csv", views: "/views.csv" },
  real: { completions: "/scrapercompletions.csv", views: "/scraperviews.csv" },
};

/** Context shape now exposes strongly-typed arrays */
type KnowbyCtx = {
  source: DataSource;
  switchSource: (next: DataSource) => void;
  reload: () => void;
  completions: CompletionData[];
  views: ViewData[];
  status: Status;
  error: unknown;
  lastUpdated: number | null;
};

type CacheEntry = { c: CompletionData[]; v: ViewData[]; t: number };
const Ctx = createContext<KnowbyCtx | null>(null);

/** ---- Helpers ---- */
function parseDDMMYYYY_withTime(
  dateStr: string | undefined,
  timeStr?: string,
  isoDateTimeStr?: string
): { parsedDateTime: Date; ts: number; ymd: string } | null {
  if (!dateStr) return null;

  // 1) If an ISO datetime is provided, prefer it (and keep it local by constructing Date directly)
  if (isoDateTimeStr) {
    const d = new Date(isoDateTimeStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      return {
        parsedDateTime: d,
        ts: d.getTime(),
        ymd: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }
  }

  // 2) Parse dd/MM/yyyy
  const [dd, mm, yyyy] = String(dateStr).split("/").map((x) => parseInt(String(x).trim(), 10));
  if (!yyyy || !mm || !dd) return null;

  // Build local date; avoid TZ drift by using y,m-1,dd directly
  const d = new Date(yyyy, mm - 1, dd);

  // 3) If time exists, set hours/min/sec; else leave midnight
  if (timeStr) {
    const [hh = "0", min = "0", ss = "0"] = timeStr.split(":");
    d.setHours(parseInt(hh, 10) || 0, parseInt(min, 10) || 0, parseInt(ss, 10) || 0, 0);
  }

  return {
    parsedDateTime: d,
    ts: d.getTime(),
    ymd: `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
  };
}


function asCompletionRow(row: any): CompletionData | null {
  const knowby_id = String(row?.knowby_id ?? "").trim();
  const dateStr = String(row?.date ?? "").trim();
  if (!knowby_id || !dateStr) return null;

  const timeStr = row?.time ? String(row.time).trim() : undefined;
  const isoStr = row?.datetime ? String(row.datetime).trim() : undefined;

  const parsed = parseDDMMYYYY_withTime(dateStr, timeStr, isoStr);
  if (!parsed) return null;

  return {
    organisation_name: row?.organisation_name ?? undefined,
    knowby_id,
    knowby_name: row?.knowby_name ?? undefined,
    member_id: row?.member_id ?? undefined,
    member_name: row?.member_name ?? undefined,
    date: dateStr,
    time: timeStr,
    datetime: isoStr,
    parsedDateTime: parsed.parsedDateTime,
    ts: parsed.ts,
    ymd: parsed.ymd,
  };
}

function asViewRow(row: any): ViewData | null {
  const dateStr = String(row?.date ?? "").trim();
  if (!dateStr) return null;

  const timeStr = row?.time ? String(row.time).trim() : undefined;
  const isoStr = row?.datetime ? String(row.datetime).trim() : undefined;

  const parsed = parseDDMMYYYY_withTime(dateStr, timeStr, isoStr);
  if (!parsed) return null;

  return {
    organisation_name: row?.organisation_name ?? undefined,
    knowby_id: row?.knowby_id ?? undefined,
    knowby_name: row?.knowby_name ?? undefined,
    member_id: row?.member_id ?? undefined,
    member_name: row?.member_name ?? undefined,
    date: dateStr,
    time: timeStr,
    datetime: isoStr,
    parsedDateTime: parsed.parsedDateTime,
    ts: parsed.ts,
    ymd: parsed.ymd,
  };
}


export function KnowbyDataProvider({ children }: { children: React.ReactNode }) {
  // pick initial mode: localStorage -> env -> 'sample'
  const [source, setSource] = useState<DataSource>(() => {
    const envDefault = (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ?? "sample";
    if (typeof window === "undefined") return envDefault;
    return (localStorage.getItem("ffs:dataMode") as DataSource | null) ?? envDefault;
  });

  useEffect(() => {
    try { localStorage.setItem("ffs:dataMode", source); } catch { /* no-op */ }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ffs:dataMode-change", { detail: { dataMode: source } }));
    }
  }, [source]);

  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [views, setViews] = useState<ViewData[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<DataSource, CacheEntry>>>({});

  const fetchFor = useCallback(
    async (src: DataSource, signal?: AbortSignal) => {
      const { completions: compUrl, views: viewUrl } = ENDPOINTS[src];

      const [compText, viewText] = await Promise.all([
        fetch(compUrl, { signal }).then((r) => r.text()),
        fetch(viewUrl, { signal }).then((r) => r.text()),
      ]);

      const rawC = Papa.parse(compText, { header: true, skipEmptyLines: true }).data as any[];
      const rawV = Papa.parse(viewText, { header: true, skipEmptyLines: true }).data as any[];

      // Map → type-safe arrays; drop clearly invalid rows; attach parsed fields once.
      const c: CompletionData[] = rawC
        .map(asCompletionRow)
        .filter((r): r is CompletionData => r !== null)
        .sort((a, b) => (a.ts! - b.ts!));

      const v: ViewData[] = rawV
        .map(asViewRow)
        .filter((r): r is ViewData => r !== null)
        .sort((a, b) => (a.ts! - b.ts!));

      return { c, v };
    },
    []
  );

  const switchSource = useCallback(
    async (next: DataSource) => {
      setSource(next);

      const cached = cacheRef.current[next];
      if (cached) {
        setCompletions(cached.c);
        setViews(cached.v);
        setStatus("refreshing");
      } else {
        setStatus("loading");
      }

      try {
        const ac = new AbortController();
        abortRef.current?.abort();
        abortRef.current = ac;

        const { c, v } = await fetchFor(next, ac.signal);
        cacheRef.current[next] = { c, v, t: Date.now() };
        setCompletions(c);
        setViews(v);
        setLastUpdated(Date.now());
        setStatus("ready");
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e);
          setStatus("error");
        }
      }
    },
    [fetchFor]
  );

  const reload = useCallback(async () => {
    const cur = source;
    setStatus((prev) => (prev === "ready" ? "refreshing" : "loading"));

    try {
      const ac = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ac;

      const { c, v } = await fetchFor(cur, ac.signal);
      cacheRef.current[cur] = { c, v, t: Date.now() };
      setCompletions(c);
      setViews(v);
      setLastUpdated(Date.now());
      setStatus("ready");
      
      // Show notification for real data refresh
      showRefreshNotification(c, v, cur);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e);
        setStatus("error");
      }
    }
  }, [source, fetchFor]);

  useEffect(() => {
    switchSource(source);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.dataMode as DataSource | undefined;
      if (mode === "sample" || mode === "real") switchSource(mode);
    };
    window.addEventListener("ffs:dataMode-change", handler as EventListener);
    return () => window.removeEventListener("ffs:dataMode-change", handler as EventListener);
  }, [switchSource]);

  const value = useMemo<KnowbyCtx>(
    () => ({
      source,
      switchSource,
      reload,
      completions,
      views,
      status,
      error,
      lastUpdated,
    }),
    [source, switchSource, reload, completions, views, status, error, lastUpdated]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowbyData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKnowbyData must be used within KnowbyDataProvider");
  return ctx;
}
