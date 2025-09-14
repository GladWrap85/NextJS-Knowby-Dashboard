// Canonical types used everywhere

// Completions (from completions.csv)
export interface CompletionData {
  organisation_name?: string;
  knowby_id: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string; // dd/MM/yyyy
}

// Views (from views.csv)
export interface ViewData {
  organisation_name?: string;
  knowby_id?: string;
  knowby_name?: string;
  member_id?: string;
  member_name?: string;
  date: string; // dd/MM/yyyy
}

// Published knowbys metadata (from a published.csv you may add later)
export interface KnowbyMeta {
  knowby_id: string;
  organisation: string;
  title: string;
  description: string;
  created_at: string;          // dd/MM/yyyy
  created_by_member_id: string;
  member_name: string;         // creator name
  status: string;
  visibility: string;
  views: string;               // numeric string
  last_viewed: string;         // dd/MM/yyyy
}

// For the StatsTable "type" prop
export type TableType = "active" | "new" | "viewed" | "unused";
