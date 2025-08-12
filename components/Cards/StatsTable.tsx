"use client";

// Importing UI table components from ShadCN
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Defining the structure of knowby record based on CSV Fields
interface KnowbyData {
  knowby_id: string;
  organisation: string;
  title: string;
  description: string;
  created_at: string;
  created_by_member_id: string;
  member_name: string;
  status: string;
  visibility: string;
  views: string;
  last_viewed: string;
}

interface CompletionData {
  organisation_name: string;
  knowby_id: string;
  knowby_name: string;
  member_id: string;
  member_name: string;
  date: string;
}

// Defined table types for conditional rendering
type TableType = "active" | "new" | "viewed" | "unused";

// Reusable table component for all stat popups.
export default function StatsTable({
  data,
  caption,
  type,
}: {
  data: KnowbyData[] | CompletionData[];  
  caption: string;
  type: TableType;
}) {
  // Dynamically sort and prepare the data based on type
  const getSortedData = () => {
    switch (type) {

      case "active":
        // Count how many completions each member has
        const completionCounts: Record<string, { member_name: string; count: number }> = {};
        (data as CompletionData[]).forEach((d) => {
          const id = d.member_id;
          if (!completionCounts[id]) completionCounts[id] = { member_name: d.member_name, count: 0 };
          completionCounts[id].count += 1;
        });
      
        // Convert object to array and sort by count descending
        return Object.entries(completionCounts)
          .map(([id, info]) => ({
            member_id: id,
            member_name: info.member_name,
            count: info.count,
          }))
          .sort((a, b) => b.count - a.count);

          case "new":
            // Sort knowbys by most recent creation date
            return [...(data as KnowbyData[])].sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
          
          case "viewed":
            // Sort by most recently viewed knowbys
            return [...(data as KnowbyData[])].sort((a, b) => parseDate(b.last_viewed) - parseDate(a.last_viewed));
          
          case "unused":
            // Sort by number of views (descending)
            return [...(data as KnowbyData[])].sort((a, b) => parseInt(b.views) - parseInt(a.views));

      default:
        return [];
    }
  };

  const parsedData = getSortedData(); // Run the sort logic

  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {type === "active" && (
            <>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Completions</TableHead>
            </>
          )}

          {type === "new" && (
            <>
              <TableHead>Title</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Created At</TableHead>
            </>
          )}

          {type === "viewed" && (
            <>
              <TableHead>Title</TableHead>
              <TableHead>Last Viewed</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </>
          )}

          {type === "unused" && (
            <>
              <TableHead>Title</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Last Viewed</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parsedData.map((row: any, idx: number) => (
          <TableRow key={idx}>
            {type === "active" && (
              <>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
              </>
            )}

            {type === "new" && (
              <>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.created_at}</TableCell>
              </>
            )}

            {type === "viewed" && (
              <>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.last_viewed}</TableCell>
                <TableCell className="text-right">{row.views}</TableCell>
              </>
            )}

            {type === "unused" && (
              <>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.member_name}</TableCell>
                <TableCell className="text-right">{row.last_viewed}</TableCell>
                <TableCell className="text-right">{row.views}</TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Helper function to convert DD/MM/YYYY string to timestamp for sorting
function parseDate(dateStr: string): number {
  const [day, month, year] = dateStr.split("/").map((n) => parseInt(n));
  return new Date(year, month - 1, day).getTime();
}
