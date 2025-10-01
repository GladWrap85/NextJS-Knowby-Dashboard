"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  createContext,
  useContext,
} from "react";
import Papa from "papaparse";

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
export type DataSource = "test" | "sample";

export interface GroupedData {
  completionsByDay: Map<string, CompletionData[]>;
  viewsByDay: Map<string, ViewData[]>;
  knowbysByDay: Map<string, KnowbyMeta[]>;
}

interface Status {
  loading: boolean;
  success: boolean;
}

type KnowbyCtx = {
  source: DataSource;
  switchSource: (next: DataSource) => void;
  reload: () => void;
  completions: CompletionData[];
  views: ViewData[];
  knowbys: KnowbyMeta[];
  grouped: GroupedData;
  status: Status;
  error: unknown;
  lastUpdated: number | null;
};

const KnowbyContext = createContext<KnowbyCtx | null>(null);

export function useKnowbyData(): KnowbyCtx {
  const ctx = useContext(KnowbyContext);
  if (!ctx) throw new Error("useKnowbyData must be used inside KnowbyProvider");
  return ctx;
}

// ----------------------------------
// Endpoints mapping for each source
// ----------------------------------
const ENDPOINTS: Record<
  DataSource,
  { completions: string; views: string; knowbys: string }
> = {
  test: {
    completions: "/completions.csv",
    views: "/views.csv",
    knowbys: "/knowbys.csv",
  },
  sample: {
    completions: "/scrapercompletions.csv",
    views: "/scraperviews.csv",
    knowbys: "/scraperpublished.csv",
  },
};

export function KnowbyDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [source, setSource] = useState<DataSource>("test");

  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [views, setViews] = useState<ViewData[]>([]);
  const [knowbys, setKnowbys] = useState<KnowbyMeta[]>([]);
  const [grouped, setGrouped] = useState<GroupedData>({
    completionsByDay: new Map(),
    viewsByDay: new Map(),
    knowbysByDay: new Map(),
  });

  const [status, setStatus] = useState<Status>({
    loading: true,
    success: false,
  });
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // --------------------------
  // helpers
  // --------------------------
  function groupByDay<
    T extends { date?: string; created_at?: string; last_viewed?: string }
  >(items: T[], key: "date" | "created_at" | "last_viewed"): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const raw = key === "date" ? (item as any).date : (item as any)[key];
      if (!raw) continue;
      const day = raw.split("T")[0]; // normalize to yyyy-MM-dd
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(item);
    }
    return map;
  }

  // --------------------------
  // switching + loading
  // --------------------------
  const switchSource = useCallback((next: DataSource) => {
    setSource(next);
  }, []);

  useEffect(() => {
    async function loadData() {
      setStatus({ loading: true, success: false });
      setError(null);

      try {
        const {
          completions: compUrl,
          views: viewUrl,
          knowbys: knowbyUrl,
        } = ENDPOINTS[source];

        const [cText, vText, kText] = await Promise.all([
          fetch(compUrl).then((r) => r.text()),
          fetch(viewUrl).then((r) => r.text()),
          fetch(knowbyUrl).then((r) => r.text()),
        ]);

        const c = Papa.parse<CompletionData>(cText, {
          header: true,
        }).data.filter(Boolean);
        const v = Papa.parse<ViewData>(vText, { header: true }).data.filter(
          Boolean
        );
        const k = Papa.parse<KnowbyMeta>(kText, { header: true }).data.filter(
          Boolean
        );

        setCompletions(c);
        setViews(v);
        setKnowbys(k);

        setGrouped({
          completionsByDay: groupByDay(c, "date"),
          viewsByDay: groupByDay(v, "date"),
          knowbysByDay: groupByDay(k, "created_at"),
        });

        setStatus({ loading: false, success: true });
        setLastUpdated(Date.now());
      } catch (e) {
        console.error("Error loading Knowby data", e);
        setError(e);
        setStatus({ loading: false, success: false });
      }
    }

    loadData();
  }, [source]);

  const value = useMemo(
    () => ({
      source,
      switchSource,
      reload: () => switchSource(source),
      completions,
      views,
      knowbys,
      grouped,
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
      grouped,
      status,
      error,
      lastUpdated,
    ]
  );

  return (
    <KnowbyContext.Provider value={value}>{children}</KnowbyContext.Provider>
  );
}
