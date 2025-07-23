'use client';
import TotalUsageCard from "@/components/Cards/TotalUsageCard";
import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
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
import KnowbyStats from "@/components/Cards/KnowbyStats"


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
            <TooltipProvider>
              <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-20 h-20 rounded-2xl text-white bg-linear-to-b from-blue-500 to-blue-700">
                    <TrendingUp className="h-10 w-10" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-semibold">Top Performing Knowby</h3>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-bold leading-none">Forklift Safety 101</div>
                      <p className="text-sm text-muted-foreground"></p>
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                <CardFooter className="flex items-center justify-between text-muted-foreground text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        <span>127</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Total Views</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4" />
                        <span>115</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Total Completions</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" />
                        <span>89.91%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Completion Rate</TooltipContent>
                  </Tooltip>
                </CardFooter>
              </Card>
            </TooltipProvider>

            <Card>Test</Card>
            <Card>Test</Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Knowby Stats</CardTitle>
                <CardDescription>Overview of knowby activity and usage.</CardDescription>
              </CardHeader>
              <CardContent>
                <KnowbyStats />
              </CardContent>
            </Card>
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