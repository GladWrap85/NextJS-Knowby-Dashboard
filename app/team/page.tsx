'use client';
import TotalUsageCard from "@/components/Cards/TotalUsageCard";
import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
import TopKnowbyCard from "@/components/Cards/TopKnowbyCard";
import ModularGraphCard from "@/components/Cards/InsightsCard";
import ActiveKnowbys from "@/components/Cards/ActiveKnowbys"
import Calendar from "@/components/Cards/Calendar"
import { DataTableDemo } from "@/components/Cards/DataTable"
import General from "@/components/Cards/General"
import Lines from "@/components/Cards/Line"
import MonthlyViews from "@/components/Cards/MonthlyViews"
import { TableDemo } from "@/components/Cards/Table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import LineWithDropdown from "@/components/Cards/Linev2"
import { CheckCircle, Eye, Settings, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDateRange } from "@/lib/DateRangeContext"; // Import the custom hook

export default function TeamSettings() {
  const { dateRange } = useDateRange(); // Get the dateRange from the context

  return (
    <div className="grid gap-[32px]">
      <div className="grid">
        <div className="grid gap-[32px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[32px]">
            <TotalUsageCard />

            {/* TODAYS USAGE STAT CARD */}
            {/* Pass the dateRange prop to TodaysUsageCard */}
            <TodaysUsageCard selectedDateRange={dateRange} />

            {/* BEST PERFORMING KNOWBY STAT CARD */}
            <TopKnowbyCard selectedDateRange={dateRange} />

            <ModularGraphCard />
            <Card>Test</Card>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[32px] lg:h-[300px] mb-[32px]">
        <Card className="overflow-y-scroll">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>These are the users of the month.</CardDescription>
          </CardHeader>
          <div className="px-4">
            <DataTableDemo />
          </div>
        </Card>
        <Card className="overflow-y-scroll">
          <CardHeader>
            <CardTitle>Highest Performing Employees</CardTitle>
            <CardDescription>These are the employees with the greatest completions.</CardDescription>
          </CardHeader>
          <div className="px-4 max-h-[350px]">
            <TableDemo />
          </div>
        </Card>
      </div>
    </div>
  );
}