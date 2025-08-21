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

export type DataSource = "sample" | "real";
type CsvRow = Record<string, any>;
type Status = "loading" | "ready" | "refreshing" | "error";

export const ENDPOINTS: Record<DataSource, { completions: string; views: string }> = {
  sample: { completions: "/completions.csv", views: "/views.csv" },
  real: { completions: "/scrapercompletions.csv", views: "/scraperviews.csv" },
};

type KnowbyCtx = {
  // current mode
  source: DataSource;
  // smooth switch (keeps cached data visible, refreshes in bg)
  switchSource: (next: DataSource) => void;
  // manual refresh of current source
  reload: () => void;

  // parsed arrays (shared by all cards)
  completions: CsvRow[];
  views: CsvRow[];

  // status & errors
  status: Status;
  error: unknown;
  lastUpdated: number | null;
};

type CacheEntry = { c: CsvRow[]; v: CsvRow[]; t: number };

const Ctx = createContext<KnowbyCtx | null>(null);

export function KnowbyDataProvider({ children }: { children: React.ReactNode }) {
  // pick initial mode: localStorage -> env -> 'sample'
  const [source, setSource] = useState<DataSource>(() => {
    const envDefault = (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ?? "sample";
    if (typeof window === "undefined") return envDefault;
    return (localStorage.getItem("ffs:dataMode") as DataSource | null) ?? envDefault;
  });

  // persist + optional legacy event
  useEffect(() => {
    try { localStorage.setItem("ffs:dataMode", source); } catch { }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ffs:dataMode-change", { detail: { dataMode: source } }));
    }
  }, [source]);

  // shared state
  const [completions, setCompletions] = useState<CsvRow[]>([]);
  const [views, setViews] = useState<CsvRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<DataSource, CacheEntry>>>({});

  // low-level fetcher for a given source
  const fetchFor = useCallback(
    async (src: DataSource, signal?: AbortSignal) => {
      const { completions: compUrl, views: viewUrl } = ENDPOINTS[src];
      const [compText, viewText] = await Promise.all([
        fetch(compUrl, { signal }).then((r) => r.text()),
        fetch(viewUrl, { signal }).then((r) => r.text()),
      ]);
      const c = Papa.parse(compText, { header: true, skipEmptyLines: true }).data as CsvRow[];
      const v = Papa.parse(viewText, { header: true, skipEmptyLines: true }).data as CsvRow[];
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
