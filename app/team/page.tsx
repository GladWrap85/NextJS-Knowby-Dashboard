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
import KnowbyStats from "@/components/Cards/KnowbyStats"
import ScraperButton from "@/components/ScraperButton"

//new imports for popups
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight } from "lucide-react";

export default function TeamSettings() {
  const { dateRange } = useDateRange(); // Get the dateRange from the context

  return (
    <div className="grid gap-[32px]">
      <div className="flex justify-center">
        <ScraperButton />
      </div>
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

        {/* 
        New Code for testing clickable popups
        Card wrapped within dialogTriggers to make it clickable.
        */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="relative cursor-pointer hover:shadow-lg transition">
              <CardHeader>
                <CardTitle>Highest Performing Employees</CardTitle>
                <CardDescription>
                  These are the employees with the greatest completions.
                </CardDescription>
                <ChevronRight
                  size={16}
                  className="absolute top-2 right-2 text-muted-foreground rotate-90"
                />
              </CardHeader>
              <div className="px-6 py-1 text-sm text-muted-foreground">
                Click to view full table →
              </div>
            </Card>
          </DialogTrigger>

          {/* 
          Modal dialog box shown when card is clicked
          */}
          <DialogContent className="max-w-3xl p-6 bg-background">
            <DialogTitle>Highest Performing Employees</DialogTitle>
            <div className="max-h-[500px] overflow-y-auto mt-4">
              <TableDemo />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}