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
  date: string; // dd/MM/yyyy (original)
  time?: string; // HH:mm:ss (optional)
  datetime?: string; // ISO string (optional, if you ever add it)
  parsedDateTime?: Date; // added: parsed once (date+time)
  ts?: number; // added: parsedDateTime.getTime()
  ymd?: string; // added: 'YYYY-MM-DD' key
}

export interface ViewData {
  organisation_name?: string;
  knowby_id?: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string; // dd/MM/yyyy (original)
  time?: string; // HH:mm:ss (optional)
  datetime?: string; // ISO string (optional)
  parsedDateTime?: Date; // added
  ts?: number; // added
  ymd?: string; // added
}

/** Knowby catalog row (from knowbys.csv / scraperpublished.csv) */
export interface KnowbyMeta {
  knowby_id: string;
  knowby_name?: string;

  // raw columns as found in CSVs (best-effort aliases supported)
  created_date?: string;
  created_time?: string;
  created_datetime?: string;

  // parsed helpers
  createdAt?: Date;
  createdTs?: number;
  createdYmd?: string;
}

/** Endpoints for each mode */
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

/** Context shape now exposes strongly-typed arrays (incl. knowbys) */
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

type CacheEntry = {
  c: CompletionData[];
  v: ViewData[];
  k: KnowbyMeta[];
  t: number;
};
const Ctx = createContext<KnowbyCtx | null>(null);

/* -------------------- Helpers -------------------- */

function coalesce<T = string>(obj: any, keys: string[]): T | undefined {
  for (const key of keys) {
    const v = obj?.[key];
    if (v != null && String(v).trim() !== "") return v as T;
  }
  return undefined;
}

/** Parse dd/MM/yyyy with optional time or an ISO datetime string (preferred). */
function parseDDMMYYYY_withTime(
  dateStr: string | undefined,
  timeStr?: string,
  isoDateTimeStr?: string
): { parsedDateTime: Date; ts: number; ymd: string } | null {
  if (!dateStr && !isoDateTimeStr) return null;

  // Prefer ISO datetime if present
  if (isoDateTimeStr) {
    const d = new Date(isoDateTimeStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear(),
        m = d.getMonth() + 1,
        day = d.getDate();
      return {
        parsedDateTime: d,
        ts: d.getTime(),
        ymd: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(
          2,
          "0"
        )}`,
      };
    }
  }

  if (!dateStr) return null;

  // Parse dd/MM/yyyy
  const [dd, mm, yyyy] = String(dateStr)
    .split("/")
    .map((x) => parseInt(String(x).trim(), 10));
  if (!yyyy || !mm || !dd) return null;

  const d = new Date(yyyy, mm - 1, dd);

  // Apply time if available (HH:mm or HH:mm:ss)
  if (timeStr) {
    const [hh = "0", min = "0", ss = "0"] = timeStr.split(":");
    d.setHours(
      parseInt(hh, 10) || 0,
      parseInt(min, 10) || 0,
      parseInt(ss, 10) || 0,
      0
    );
  }

  return {
    parsedDateTime: d,
    ts: d.getTime(),
    ymd: `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
      2,
      "0"
    )}`,
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

/** Parse a catalog row from knowbys.csv / scraperpublished.csv */
function asKnowbyRow(row: any): KnowbyMeta | null {
  const knowby_id = String(
    coalesce(row, ["knowby_id", "id", "Knowby Id"]) ?? ""
  ).trim();
  if (!knowby_id) return null;

  const knowby_name =
    coalesce(row, ["knowby_name", "name", "title", "Knowby Name"]) ?? undefined;

  // in asKnowbyRow
  const created_date = (
    coalesce(row, ["created_date", "published_date", "date", "created_at"]) as
      | string
      | undefined
  )?.trim();

  const created_time = (
    coalesce(row, ["created_time", "published_time", "time"]) as
      | string
      | undefined
  )?.trim();

  // only real datetime-like fields here
  const created_datetime = (
    coalesce(row, ["created_datetime", "published_datetime", "datetime"]) as
      | string
      | undefined
  )?.trim();

  const parsed = parseDDMMYYYY_withTime(
    created_date,
    created_time,
    created_datetime
  );

  return {
    knowby_id,
    knowby_name,
    created_date,
    created_time,
    created_datetime,
    createdAt: parsed?.parsedDateTime,
    createdTs: parsed?.ts,
    createdYmd: parsed?.ymd,
  };
}

/* -------------------- Provider -------------------- */

export function KnowbyDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // pick initial mode: localStorage -> env -> 'sample'
  const [source, setSource] = useState<DataSource>(() => {
    const envDefault =
      (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ??
      "sample";
    if (typeof window === "undefined") return envDefault;
    return (
      (localStorage.getItem("ffs:dataMode") as DataSource | null) ?? envDefault
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem("ffs:dataMode", source);
    } catch {
      /* no-op */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ffs:dataMode-change", { detail: { dataMode: source } })
      );
    }
  }, [source]);

  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [views, setViews] = useState<ViewData[]>([]);
  const [knowbys, setKnowbys] = useState<KnowbyMeta[]>([]); // NEW

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<DataSource, CacheEntry>>>({});

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

      const rawC = Papa.parse(compText, { header: true, skipEmptyLines: true })
        .data as any[];
      const rawV = Papa.parse(viewText, { header: true, skipEmptyLines: true })
        .data as any[];
      const rawK = Papa.parse(knowbyText, {
        header: true,
        skipEmptyLines: true,
      }).data as any[];

      // Map → type-safe arrays; drop clearly invalid rows; attach parsed fields once.
      const c: CompletionData[] = rawC
        .map(asCompletionRow)
        .filter((r): r is CompletionData => r !== null)
        .sort((a, b) => a.ts! - b.ts!);

      const v: ViewData[] = rawV
        .map(asViewRow)
        .filter((r): r is ViewData => r !== null)
        .sort((a, b) => a.ts! - b.ts!);

      const k: KnowbyMeta[] = rawK
        .map(asKnowbyRow)
        .filter((r): r is KnowbyMeta => !!r && r.createdTs != null)
        .sort((a, b) => a.createdTs! - b.createdTs!);

      return { c, v, k };
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
        setKnowbys(cached.k);
        setStatus("refreshing");
      } else {
        setStatus("loading");
      }

      try {
        const ac = new AbortController();
        abortRef.current?.abort();
        abortRef.current = ac;

        const { c, v, k } = await fetchFor(next, ac.signal);
        cacheRef.current[next] = { c, v, k, t: Date.now() };
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

  const reload = useCallback(async () => {
    const cur = source;
    setStatus((prev) => (prev === "ready" ? "refreshing" : "loading"));

    try {
      const ac = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ac;

      const { c, v, k } = await fetchFor(cur, ac.signal);
      cacheRef.current[cur] = { c, v, k, t: Date.now() };
      setCompletions(c);
      setViews(v);
      setKnowbys(k);
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
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.dataMode as
        | DataSource
        | undefined;
      if (mode === "sample" || mode === "real") switchSource(mode);
    };
    window.addEventListener("ffs:dataMode-change", handler as EventListener);
    return () =>
      window.removeEventListener(
        "ffs:dataMode-change",
        handler as EventListener
      );
  }, [switchSource]);

  const value = useMemo<KnowbyCtx>(
    () => ({
      source,
      switchSource,
      reload,
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
      reload,
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

/** Hook */
export function useKnowbyData() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useKnowbyData must be used within KnowbyDataProvider");
  return ctx;
}
