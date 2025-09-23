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
type Status = "loading" | "ready" | "refreshing" | "error";

export interface CompletionData {
  knowby_id: string;
  member_id?: string;
  date: string;
  organisation?: string;
  member_name?: string;
  knowby_name?: string;
}
export interface ViewData {
  knowby_id?: string;
  member_id?: string;
  date: string;
  organisation?: string;
  member_name?: string;
  knowby_name?: string;
}
export interface KnowbyMeta {
  knowby_id: string;
  title?: string;
  description?: string;
  created_at: string;
  last_viewed?: string;
  organisation: string; // required for StatsTable
  created_by_member_id?: string;
  member_name?: string;
  status?: string;
  visibility?: string;
  views?: number;
}

export const ENDPOINTS: Record<
  DataSource,
  { completions: string; views: string; knowbys: string }
> = {
  sample: {
    completions: "/completions.csv",
    views: "/views.csv",
    knowbys: "/knowbys.csv",
  },
  real: {
    completions: "/scrapercompletions.csv",
    views: "/scraperviews.csv",
    knowbys: "/scraperpublished.csv",
  },
};

type KnowbyCtx = {
  source: DataSource;
  switchSource: (next: DataSource) => void;
  reload: () => void;
  completions: CompletionData[];
  views: ViewData[];
  knowbys: KnowbyMeta[];
  status: Status;
  error: unknown;
  lastUpdated: number | null;
};

const Ctx = createContext<KnowbyCtx | null>(null);

// ---------- Parsers ----------

function asCompletionRow(row: any): CompletionData | null {
  const knowby_id = String(row?.knowby_id ?? "").trim();
  const date = String(row?.date ?? "").trim();
  if (!knowby_id || !date) return null;
  return {
    knowby_id,
    member_id: row?.member_id,
    date,
    organisation: row?.organisation,
    member_name: row?.member_name,
    knowby_name: row?.knowby_name,
  };
}

function asViewRow(row: any): ViewData | null {
  const date = String(row?.date ?? "").trim();
  if (!date) return null;
  return {
    knowby_id: row?.knowby_id,
    member_id: row?.member_id,
    date,
    organisation: row?.organisation_name,
    member_name: row?.member_name,
    knowby_name: row?.knowby_name,
  };
}

function asKnowbyRow(row: any): KnowbyMeta | null {
  const knowby_id = String(row?.knowby_id ?? "").trim();
  const created_at = String(row?.created_at ?? "").trim();
  if (!knowby_id || !created_at) return null;
  return {
    knowby_id,
    title: row?.title,
    description: row?.description,
    created_at,
    last_viewed: row?.last_viewed,
    organisation: row?.organisation ?? "Unknown", // default for type safety
    created_by_member_id: row?.created_by_member_id,
    member_name: row?.member_name,
    status: row?.status,
    visibility: row?.visibility,
    views: row?.views ? Number(row.views) : 0,
  };
}

// ---------- Provider ----------

export function KnowbyDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [source, setSource] = useState<DataSource>(() => {
    const envDefault =
      (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ??
      "sample";
    if (typeof window === "undefined") return envDefault;
    return (
      (localStorage.getItem("ffs:dataMode") as DataSource | null) ?? envDefault
    );
  });

  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [views, setViews] = useState<ViewData[]>([]);
  const [knowbys, setKnowbys] = useState<KnowbyMeta[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchFor = useCallback(
    async (src: DataSource, signal?: AbortSignal) => {
      const {
        completions: compUrl,
        views: viewUrl,
        knowbys: knowbyUrl,
      } = ENDPOINTS[src];
      const [compText, viewText, knowbyText] = await Promise.all([
        fetch(compUrl, { signal }).then((r) => r.text()),
        fetch(viewUrl, { signal }).then((r) => r.text()),
        fetch(knowbyUrl, { signal }).then((r) => r.text()),
      ]);

      const c = Papa.parse(compText, { header: true, skipEmptyLines: true })
        .data.map(asCompletionRow)
        .filter((r): r is CompletionData => r !== null);

      const v = Papa.parse(viewText, { header: true, skipEmptyLines: true })
        .data.map(asViewRow)
        .filter((r): r is ViewData => r !== null);

      const k = Papa.parse(knowbyText, { header: true, skipEmptyLines: true })
        .data.map(asKnowbyRow)
        .filter((r): r is KnowbyMeta => r !== null);

      return { c, v, k };
    },
    []
  );

  const switchSource = useCallback(
    async (next: DataSource) => {
      setSource(next);
      try {
        const ac = new AbortController();
        abortRef.current?.abort();
        abortRef.current = ac;
        const { c, v, k } = await fetchFor(next, ac.signal);
        setCompletions(c);
        setViews(v);
        setKnowbys(k);
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

  useEffect(() => {
    switchSource(source);
    return () => abortRef.current?.abort();
  }, []);

  const value = useMemo(
    () => ({
      source,
      switchSource,
      reload: () => switchSource(source),
      completions,
      views,
      knowbys,
      status,
      error,
      lastUpdated,
    }),
    [
      source,
      switchSource,
      completions,
      views,
      knowbys,
      status,
      error,
      lastUpdated,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowbyData() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useKnowbyData must be used within KnowbyDataProvider");
  return ctx;
}
