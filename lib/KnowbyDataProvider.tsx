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

/** Data source selector */
export type DataSource = "sample" | "real";
type Status = "loading" | "ready" | "refreshing" | "error";

/** ---- Row types mapped to your CSV shapes ----
 * Keep optional fields optional to match real-world CSV variance.
 * Dates stay as strings (dd/MM/yyyy) to match your existing code.
 */
export interface CompletionData {
  organisation_name?: string;
  knowby_id: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string; // dd/MM/yyyy
}

export interface ViewData {
  organisation_name?: string;
  knowby_id?: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string; // dd/MM/yyyy
  // If your views.csv has other columns (e.g. event_type), add them here as optional
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

/** ---- Lightweight row "normalisers" (for safety) ----
 * These ensure we at least have strings for keys we care about.
 * They also coerce undefined to '' where it helps consistency.
 */
function asCompletionRow(row: any): CompletionData | null {
  const knowby_id = String(row?.knowby_id ?? "").trim();
  const date = String(row?.date ?? "").trim();
  if (!knowby_id || !date) return null;
  return {
    organisation_name: row?.organisation_name ?? undefined,
    knowby_id,
    knowby_name: row?.knowby_name ?? undefined,
    member_id: row?.member_id ?? undefined,
    member_name: row?.member_name ?? undefined,
    date,
  };
}

function asViewRow(row: any): ViewData | null {
  const date = String(row?.date ?? "").trim();
  if (!date) return null;
  return {
    organisation_name: row?.organisation_name ?? undefined,
    knowby_id: row?.knowby_id ?? undefined,
    knowby_name: row?.knowby_name ?? undefined,
    member_id: row?.member_id ?? undefined,
    member_name: row?.member_name ?? undefined,
    date,
  };
}

export function KnowbyDataProvider({ children }: { children: React.ReactNode }) {
  // pick initial mode: localStorage -> env -> 'sample'
  const [source, setSource] = useState<DataSource>(() => {
    const envDefault = (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ?? "sample";
    if (typeof window === "undefined") return envDefault;
    return (localStorage.getItem("ffs:dataMode") as DataSource | null) ?? envDefault;
  });

  // persist + optional legacy event
  useEffect(() => {
    try { localStorage.setItem("ffs:dataMode", source); } catch { /* no-op */ }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ffs:dataMode-change", { detail: { dataMode: source } }));
    }
  }, [source]);

  // shared state
  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [views, setViews] = useState<ViewData[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<DataSource, CacheEntry>>>({});

  // low-level fetcher for a given source (now returns typed rows)
  const fetchFor = useCallback(
    async (src: DataSource, signal?: AbortSignal) => {
      const { completions: compUrl, views: viewUrl } = ENDPOINTS[src];

      const [compText, viewText] = await Promise.all([
        fetch(compUrl, { signal }).then((r) => r.text()),
        fetch(viewUrl, { signal }).then((r) => r.text()),
      ]);

      const rawC = Papa.parse(compText, { header: true, skipEmptyLines: true }).data as any[];
      const rawV = Papa.parse(viewText, { header: true, skipEmptyLines: true }).data as any[];

      // map → type-safe arrays; drop clearly invalid rows
      const c: CompletionData[] = rawC
        .map(asCompletionRow)
        .filter((r): r is CompletionData => r !== null);

      const v: ViewData[] = rawV
        .map(asViewRow)
        .filter((r): r is ViewData => r !== null);

      return { c, v };
    },
    []
  );

  // smooth mode switch: show cached if available, then refresh in bg
  const switchSource = useCallback(
    async (next: DataSource) => {
      setSource(next);

      const cached = cacheRef.current[next];
      if (cached) {
        // keep UI stable, no flicker
        setCompletions(cached.c);
        setViews(cached.v);
        setStatus("refreshing");
      } else {
        // first time for this mode
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

  // gentle refresh for current source
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
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e);
        setStatus("error");
      }
    }
  }, [source, fetchFor]);

  // initial load
  useEffect(() => {
    switchSource(source);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // optional: accept legacy external toggle events
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
