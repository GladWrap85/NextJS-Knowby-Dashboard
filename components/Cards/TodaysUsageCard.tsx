// components/Cards/TodaysUsageCard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ResponsiveBar } from "@nivo/bar";
import { getNivoTheme, useDarkMode } from "@/components/NivoWrapper";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eye, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { subDays, format, parse, isWithinInterval, eachDayOfInterval } from "date-fns";
import { DateRange } from "react-day-picker";

interface TodaysUsageCardProps {
  selectedDateRange: DateRange | undefined;
}

export default function TodaysUsageCard({ selectedDateRange }: TodaysUsageCardProps) {
  const [completionRate, setCompletionRate] = useState<number | null>(null); // For the top percentage (latest day)
  const [sevenDayCompletionRate, setSevenDayCompletionRate] = useState<number | null>(null); // For the footer percentage (7-day range)
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [selectedKnowby, setSelectedKnowby] = useState<string | null>(null);
  const [knowbyOptions, setKnowbyOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isDark = useDarkMode();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Determine the effective end date from the selected range, defaulting to today if not available
  const effectiveEndDate = selectedDateRange?.to || new Date();
  // Calculate the effective start date as 7 days prior to the effective end date
  const effectiveStartDate = subDays(effectiveEndDate, 6); // 6 days before for a 7-day range (inclusive)

  // Generate an array of dates for the last 7 days ending on effectiveEndDate
  const datesToDisplay = eachDayOfInterval({
    start: effectiveStartDate,
    end: effectiveEndDate
  }).map(date => format(date, "dd/MM/yyyy"));

  useEffect(() => {
    Papa.parse("/completions.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const uniqueKnowbys = Array.from(new Set(data.map((row) => row.knowby_name)));
        setKnowbyOptions(uniqueKnowbys);
      },
    });
  }, []);

  useEffect(() => {
    const dateCounts: Record<string, { completions: number; views: number }> = {};
    // Initialize counts for all dates in the 7-day period we want to display
    datesToDisplay.forEach((dateStr) => {
      dateCounts[dateStr] = { completions: 0, views: 0 };
    });

    let latestDayCompletions = 0;
    let latestDayViews = 0;
    const latestDayFormatted = format(effectiveEndDate, "dd/MM/yyyy"); // The "today" for this card

    const parseCSV = async () => {
      Papa.parse("/completions.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (compResults) => {
          const completions = compResults.data as any[];
          completions.forEach((row) => {
            const rowDate = parse(row.date, "dd/MM/yyyy", new Date());

            if (!row.date || (selectedKnowby && row.knowby_name !== selectedKnowby)) return;

            // Filter data for the 7-day range for the chart and footer totals
            if (isWithinInterval(rowDate, { start: effectiveStartDate, end: effectiveEndDate })) {
              const formattedDate = format(rowDate, "dd/MM/yyyy");
              if (dateCounts[formattedDate]) {
                dateCounts[formattedDate].completions++;
              }
              // Also track completions for the latest day for the main percentage
              if (formattedDate === latestDayFormatted) {
                latestDayCompletions++;
              }
            }
          });

          Papa.parse("/views.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (viewResults) => {
              const views = viewResults.data as any[];
              views.forEach((row) => {
                const rowDate = parse(row.date, "dd/MM/yyyy", new Date());

                if (!row.date || (selectedKnowby && row.knowby_name !== selectedKnowby)) return;

                // Filter data for the 7-day range for the chart and footer totals
                if (isWithinInterval(rowDate, { start: effectiveStartDate, end: effectiveEndDate })) {
                  const formattedDate = format(rowDate, "dd/MM/yyyy");
                  if (dateCounts[formattedDate]) {
                    dateCounts[formattedDate].views++;
                  }
                  // Also track views for the latest day for the main percentage
                  if (formattedDate === latestDayFormatted) {
                    latestDayViews++;
                  }
                }
              });

              // Calculate completion rate only for the *latest day* for the TOP display
              setCompletionRate(
                latestDayViews > 0 ? parseFloat(((latestDayCompletions / latestDayViews) * 100).toFixed(2)) : null
              );

              // Map data for Nivo Bar chart, ensuring all dates in datesToDisplay are present
              const data = datesToDisplay.map((dateStr) => ({
                date: dateStr,
                Completions: dateCounts[dateStr]?.completions ?? 0,
                Views: dateCounts[dateStr]?.views ?? 0,
              }));

              setDailyData(data);

              // Calculate completion rate for the *entire 7-day period* for the FOOTER
              const totalCompletionsForPeriod = data.reduce((sum, d) => sum + d.Completions, 0);
              const totalViewsForPeriod = data.reduce((sum, d) => sum + d.Views, 0);
              setSevenDayCompletionRate(
                totalViewsForPeriod > 0 ? parseFloat(((totalCompletionsForPeriod / totalViewsForPeriod) * 100).toFixed(2)) : null
              );
            },
          });
        },
      });
    };

    parseCSV();
  }, [selectedKnowby, effectiveEndDate]); // Re-run effect when selectedKnowby or effectiveEndDate changes

  const filteredKnowbys = knowbyOptions.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (name: string | null) => {
    setSelectedKnowby(name);
    setDropdownOpen(false);
  };

  // These sums are for the *displayed* data (the 7-day period ending on effectiveEndDate)
  const totalCompletions = dailyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.Views, 0);

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl text-white bg-gradient-to-b from-purple-500 to-purple-700">
            <TrendingUp className="h-10 w-10" />
          </div>

          <div className="flex flex-col gap-1">
            {/* Title fixed to "Today's Usage" */}
            <h3 className="text-xl font-semibold">Today's Usage</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-bold leading-none">
                {completionRate !== null ? `${Math.round(completionRate)}%` : "--%"}
              </div>
              <p className="text-sm text-muted-foreground">completion rate</p>
            </div>
          </div>
        </div>

        <hr className="border-border" />

        <CardContent className="pt-0">
          <div className="pb-4">
            <DropdownMenu onOpenChange={(open) => setDropdownOpen(open)} open={dropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "shadow-md max-w-[200px] truncate relative flex justify-between items-center",
                    isDark ? "hover:bg-muted/50" : "hover:bg-accent"
                  )}
                  title={selectedKnowby || "Select Knowby"}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
                    {selectedKnowby || "Select Knowby"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-2 transition-transform duration-200",
                      dropdownOpen && "rotate-90"
                    )}
                  />
                  <span className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[250px] overflow-y-auto w-60 p-2">
                <Input
                  ref={searchInputRef}
                  placeholder="Search Knowby..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="mb-2"
                />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleSelect(null);
                  }}
                  className="font-semibold"
                  title="All Knowbys"
                >
                  All Knowbys
                </DropdownMenuItem>
                {filteredKnowbys.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSelect(name);
                    }}
                    title={name}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                      {name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveBar
              data={dailyData.map((d) => ({ ...d, date: d.date }))}
              keys={["Completions", "Views"]}
              indexBy="date"
              margin={{ top: 10, right: 30, bottom: 40, left: 50 }}
              padding={0.4}
              groupMode="grouped"
              theme={getNivoTheme(isDark)}
              colors={{ scheme: "category10" }}
              axisBottom={{ tickRotation: -30 }} //change for different x-axis label roation
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Count",
                legendPosition: "middle",
                legendOffset: -40,
              }}
              tooltip={({ id, value, indexValue }) => (
                <div style={{ padding: 10, background: "#fff", borderRadius: 4 }}>
                  <strong>{id}</strong> on <strong>{indexValue}</strong>: {value}
                </div>
              )}
              borderRadius={4}
              enableLabel={false}
            />
          </div>
          <div className="pt-4">
            {/* Subtitle updated to reflect 7-day range */}
            <p className="text-sm font-semibold">Completions vs Views over the Past 7 Days</p>
            <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    <span>{totalViews}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Views for Past 7 Days</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    <span>{totalCompletions}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Completions for Past 7 Days</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {/* Now using sevenDayCompletionRate for the footer */}
                      {sevenDayCompletionRate !== null ? `${sevenDayCompletionRate.toFixed(2)}%` : "--%"}
                    </span>
                  </div>
                </TooltipTrigger>
                {/* Tooltip content updated to reflect Past 7 Days */}
                <TooltipContent>Completion Rate for Past 7 Days</TooltipContent>
              </Tooltip>
            </CardFooter>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}