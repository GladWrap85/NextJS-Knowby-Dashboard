'use client';
import TotalUsageCard from "@/components/Cards/TotalUsageCard";
import TodaysUsageCard from "@/components/Cards/TodaysUsageCard";
import TopKnowbyCard from "@/components/Cards/TopKnowbyCard";
import ModularGraphCard from "@/components/Cards/InsightsCard";
import { TableDemo } from "@/components/Cards/Table"
import { Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card"
import { useDateRange } from "@/lib/DateRangeContext"; // Import the custom hook
import KnowbyStats from "@/components/Cards/KnowbyStats"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight } from "lucide-react";
import ViewsCalendarHeatmap from "@/components/cal-heatmap";


export default function Home() {
  const { dateRange } = useDateRange(); // Get the dateRange from the context

  return (
    <div className="grid gap-[20px]">
      {/* Top row of cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
        <TotalUsageCard />
        <TodaysUsageCard selectedDateRange={dateRange} />
        <TopKnowbyCard selectedDateRange={dateRange} />
      </div>

      {/* Knowby Stats + ModularGraphCard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
        <Card>
          <CardHeader>
            <CardTitle>Knowby Stats</CardTitle>
            <CardDescription>Overview of Knowby activity and usage</CardDescription>
          </CardHeader>
          <CardContent>
            <KnowbyStats />
          </CardContent>
        </Card>

        <ModularGraphCard />
      </div>

      {/* Calendar Heatmap + Dialog Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
        <Card className="bg-card text-card-foreground flex flex-col rounded-xl border">
          <CardHeader>
            <CardTitle>Calendar Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ViewsCalendarHeatmap />
          </CardContent>
        </Card>

        <Card />
        <Card />
        {/* <Dialog>
          <DialogTrigger asChild>
            <Card className="relative cursor-pointer hover:shadow-lg">
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

          <DialogContent className="max-w-3xl p-6 bg-background">
            <DialogTitle>Highest Performing Employees</DialogTitle>
            <div className="max-h-[500px] overflow-y-auto mt-4">
              <TableDemo />
            </div>
          </DialogContent>
        </Dialog> */}
      </div>
    </div>

  );
}