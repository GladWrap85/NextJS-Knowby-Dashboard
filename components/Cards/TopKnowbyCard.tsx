// components/Cards/TopKnowbyCard.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Papa from "papaparse";
import { subDays, format, parse, isWithinInterval, eachDayOfInterval, startOfMonth, addMonths, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { getNivoTheme, useDarkMode } from "@/components/NivoWrapper";
import { CheckCircle, Eye, TrendingUp, ChevronDown, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TopKnowbyCardProps {
  selectedDateRange: DateRange | undefined;
}

// Define Nivo color schemes for consistency
const nivoColorSchemes = {
  category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928']
};

export default function TopKnowbyCard({ selectedDateRange }: TopKnowbyCardProps) {
  const [chartType, setChartType] = useState<"daily" | "monthly">("daily");
  const [selectedKnowbys, setSelectedKnowbys] = useState<string[]>([]);
  const [topKnowby, setTopKnowby] = useState<string>("Loading..."); // Stays static after initial load
  const [knowbyOptions, setKnowbyOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dailyChartData, setDailyChartData] = useState<any[]>([]); // Data for daily views/completions
  const [monthlyChartData, setMonthlyChartData] = useState<any[]>([]); // Data for monthly completion rate
  const [dropdownOpen, setDropdownOpen] = useState(false); // State for Knowby dropdown
  const isDark = useDarkMode();

  // Refs for the scrolling text and animation control
  const knowbyContainerRef = useRef<HTMLDivElement>(null); // Ref for the div with overflow: hidden
  const knowbyTextRef = useRef<HTMLSpanElement>(null); // Ref for the actual text span
  const [needsScrolling, setNeedsScrolling] = useState(false);
  const [maskGradient, setMaskGradient] = useState('none');
  const [scrollDistance, setScrollDistance] = useState('0px');
  const [animationPlayState, setAnimationPlayState] = useState<'running' | 'paused'>('paused');
  const [animationKey, setAnimationKey] = useState(0); // Key to restart animation
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Effective end date from the calendar or today
  const effectiveEndDate = useMemo(
    () => selectedDateRange?.to || new Date(),
    [selectedDateRange]
  );

  const dailyChartStartDate = useMemo(
    () => subDays(effectiveEndDate, 9),
    [effectiveEndDate]
  );


  const datesForDailyChart = useMemo(
    () =>
      eachDayOfInterval({
        start: dailyChartStartDate,
        end: effectiveEndDate,
      }).map((date) => format(date, "dd/MM/yyyy")),
    [dailyChartStartDate, effectiveEndDate]
  );

  const monthsForMonthlyChart = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        format(subMonths(effectiveEndDate, i), "MMM yyyy")
      ).reverse(),
    [effectiveEndDate]
  );


  // State to hold calculated footer stats for each selected knowby
  const [footerStats, setFooterStats] = useState<{
    [key: string]: { totalViews: number; totalCompletions: number; completionRate: number | null };
  }>({});

  // Memoize Nivo theme for performance
  const nivoTheme = getNivoTheme(isDark);

  // --- Initial Load & Top Knowby Calculation ---
  useEffect(() => {
    Papa.parse("/completions.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const completionsByKnowby: Record<string, number> = {};

        data.forEach((row) => {
          if (!row.knowby_name) return;
          completionsByKnowby[row.knowby_name] = (completionsByKnowby[row.knowby_name] || 0) + 1;
        });

        const sorted = Object.entries(completionsByKnowby).sort((a, b) => b[1] - a[1]);
        const top = sorted[0]?.[0] || "N/A";
        setTopKnowby(top);

        // Initialize selected knowbys with the top performing one, if none are selected
        setSelectedKnowbys(prev => {
          if (prev.length === 0 || (prev.length === 1 && prev[0] === "Loading...")) {
            return [top];
          }
          return prev;
        });

        setKnowbyOptions([...new Set(data.map((row) => row.knowby_name))]);
      },
    });
  }, []); // Run only once on mount to determine the overall top knowby


  // --- Effect for Text Scrolling Animation ---
  const checkOverflowAndAnimate = useCallback(() => {
    const container = knowbyContainerRef.current;
    const textSpan = knowbyTextRef.current;

    if (container && textSpan) {
      const containerWidth = container.offsetWidth;
      const textWidth = textSpan.scrollWidth; // Use scrollWidth for full content width

      const overflowAmount = textWidth - containerWidth;
      const rightEdgeFadePoint = 20; // Pixels from right edge where fade starts

      if (overflowAmount > 0) {
        setNeedsScrolling(true);
        // Calculate where the text should stop for the fade to be effective
        // The text moves LEFT, so we want it to stop when its right edge aligns with the container's right edge
        // minus the fade amount.
        const targetScrollX = overflowAmount + rightEdgeFadePoint;
        setScrollDistance(`-${targetScrollX}px`);

        // Calculate mask for overflowing text: full opacity mostly, fade at ends
        const fadeStartRight = Math.max(0, containerWidth - rightEdgeFadePoint);
        const fadeEndRight = containerWidth;
        const fadeStartLeft = 0;
        const fadeEndLeft = Math.min(containerWidth, 20); // Small fade on left edge

        setMaskGradient(
          `linear-gradient(to right,
            rgba(0,0,0,0.1) 0px, /* Minimal fade at absolute left edge */
            rgba(0,0,0,1) ${fadeEndLeft}px, /* Full opacity after minimal left fade */
            rgba(0,0,0,1) ${fadeStartRight}px, /* Full opacity until near right edge */
            rgba(0,0,0,0) ${fadeEndRight}px /* Fade out completely at right edge */
          )`
        );

        // Start animation after a brief pause
        setAnimationPlayState('running');
        // Restart animation by changing key to trigger remount/reanimation
        setAnimationKey(prev => prev + 1);

      } else {
        // No overflow, no scrolling needed
        setNeedsScrolling(false);
        setScrollDistance('0px');
        setAnimationPlayState('paused'); // Ensure animation is paused if not needed
        
        // Less concentrated fade for non-overflowing text (only edges)
        const smallFadeAmount = 10; // Smaller fade for non-overflowing text
        setMaskGradient(
          `linear-gradient(to right,
            rgba(0,0,0,0.05) 0px, /* Very minimal fade at left edge */
            rgba(0,0,0,1) ${smallFadeAmount}px,
            rgba(0,0,0,1) calc(100% - ${smallFadeAmount}px),
            rgba(0,0,0,0.05) 100% /* Very minimal fade at right edge */
          )`
        );
      }
    } else {
      setNeedsScrolling(false);
      setScrollDistance('0px');
      setMaskGradient('none');
      setAnimationPlayState('paused');
    }
  }, [topKnowby]); // Depend on topKnowby to recheck on change

  // Observe container and text changes for overflow detection
  useEffect(() => {
    checkOverflowAndAnimate(); // Initial check

    // Use ResizeObserver for more robust size detection than just window resize
    const container = knowbyContainerRef.current;
    const textSpan = knowbyTextRef.current;

    const observer = new ResizeObserver(() => {
      checkOverflowAndAnimate();
    });

    if (container) observer.observe(container);
    if (textSpan) observer.observe(textSpan); // Observe text span as well

    return () => {
      observer.disconnect();
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [checkOverflowAndAnimate, topKnowby]); // Recalculate when topKnowby changes or `checkOverflowAndAnimate` is updated


  // --- Data Processing for Charts and Footer (unchanged from your original) ---
  useEffect(() => {
    const fetchAndProcessData = async () => {
      // Data structures to aggregate counts for all selected knowbys
      const dailyCounts: Record<string, Record<string, { completions: number; views: number }>> = {}; // { knowbyName: { date: { completions, views } } }
      const monthlyCounts: Record<string, Record<string, { completions: number; views: number }>> = {}; // { knowbyName: { month: { completions, views } } }

      selectedKnowbys.forEach(knowby => {
        dailyCounts[knowby] = {};
        datesForDailyChart.forEach(date => {
          dailyCounts[knowby][date] = { completions: 0, views: 0 };
        });
        monthlyCounts[knowby] = {};
        monthsForMonthlyChart.forEach(month => {
          monthlyCounts[knowby][month] = { completions: 0, views: 0 };
        });
      });

      // Fetch completions data
      Papa.parse("/completions.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (compResults) => {
          const completions = compResults.data as any[];

          completions.forEach((row) => {
            const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
            const knowbyName = row.knowby_name;

            if (selectedKnowbys.includes(knowbyName)) {
              // Daily data for selected 10-day range
              if (isWithinInterval(rowDate, { start: dailyChartStartDate, end: effectiveEndDate })) {
                const formattedDailyDate = format(rowDate, "dd/MM/yyyy");
                if (dailyCounts[knowbyName] && dailyCounts[knowbyName][formattedDailyDate]) {
                  dailyCounts[knowbyName][formattedDailyDate].completions++;
                }
              }
              // Monthly data for selected 12-month range
              const formattedMonthlyDate = format(rowDate, "MMM yyyy");
              if (monthsForMonthlyChart.includes(formattedMonthlyDate)) { // Ensure within the last 12 months
                if (monthlyCounts[knowbyName] && monthlyCounts[knowbyName][formattedMonthlyDate]) {
                  monthlyCounts[knowbyName][formattedMonthlyDate].completions++;
                }
              }
            }
          });

          // Fetch views data
          Papa.parse("/views.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (viewResults) => {
              const views = viewResults.data as any[];

              views.forEach((row) => {
                const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
                const knowbyName = row.knowby_name;

                if (selectedKnowbys.includes(knowbyName)) {
                  // Daily data for selected 10-day range
                  if (isWithinInterval(rowDate, { start: dailyChartStartDate, end: effectiveEndDate })) {
                    const formattedDailyDate = format(rowDate, "dd/MM/yyyy");
                    if (dailyCounts[knowbyName] && dailyCounts[knowbyName][formattedDailyDate]) {
                      dailyCounts[knowbyName][formattedDailyDate].views++;
                    }
                  }
                  // Monthly data for selected 12-month range
                  const formattedMonthlyDate = format(rowDate, "MMM yyyy");
                  if (monthsForMonthlyChart.includes(formattedMonthlyDate)) { // Ensure within the last 12 months
                    if (monthlyCounts[knowbyName] && monthlyCounts[knowbyName][formattedMonthlyDate]) {
                      monthlyCounts[knowbyName][formattedMonthlyDate].views++;
                    }
                  }
                }
              });

              // --- Prepare Daily Chart Data (Bar Chart) ---
              // This chart is for a single selected knowby, showing its views and completions
              const newDailyChartData: any[] = [];
              if (chartType === "daily" && selectedKnowbys.length === 1) {
                const singleKnowby = selectedKnowbys[0];
                datesForDailyChart.forEach(date => {
                  newDailyChartData.push({
                    date,
                    Completions: dailyCounts[singleKnowby]?.[date]?.completions || 0,
                    Views: dailyCounts[singleKnowby]?.[date]?.views || 0,
                  });
                });
              }
              setDailyChartData(newDailyChartData);

              // --- Prepare Monthly Chart Data (Line Chart) ---
              // This chart is for 1 or 2 selected knowbys, comparing their completion rates
              const newMonthlyChartData: any[] = selectedKnowbys.map(knowbyName => {
                const dataPoints = monthsForMonthlyChart.map(month => {
                  const totalCompletions = monthlyCounts[knowbyName]?.[month]?.completions || 0;
                  const totalViews = monthlyCounts[knowbyName]?.[month]?.views || 0;
                  const completionRate = totalViews > 0 ? parseFloat(((totalCompletions / totalViews) * 100).toFixed(2)) : 0;
                  return { x: month, y: completionRate };
                });
                return {
                  id: knowbyName,
                  data: dataPoints,
                };
              });
              setMonthlyChartData(newMonthlyChartData);

              // --- Calculate Footer Stats ---
              const newFooterStats: typeof footerStats = {};
              selectedKnowbys.forEach(knowbyName => {
                let totalViewsForFooter = 0;
                let totalCompletionsForFooter = 0;
              
                if (chartType === "monthly") {
                  // Sum over the last 12 months
                  monthsForMonthlyChart.forEach(month => {
                    totalViewsForFooter += monthlyCounts[knowbyName]?.[month]?.views || 0;
                    totalCompletionsForFooter += monthlyCounts[knowbyName]?.[month]?.completions || 0;
                  });
                } else {
                  // Sum over the last 10 days
                  datesForDailyChart.forEach(date => {
                    totalViewsForFooter += dailyCounts[knowbyName]?.[date]?.views || 0;
                    totalCompletionsForFooter += dailyCounts[knowbyName]?.[date]?.completions || 0;
                  });
                }
              
                const completionRateForFooter = totalViewsForFooter > 0
                  ? parseFloat(((totalCompletionsForFooter / totalViewsForFooter) * 100).toFixed(2))
                  : null;
              
                newFooterStats[knowbyName] = {
                  totalViews: totalViewsForFooter,
                  totalCompletions: totalCompletionsForFooter,
                  completionRate: completionRateForFooter,
                };
              });
              setFooterStats(newFooterStats);
            },
          });
        },
      });
    };

    if (selectedKnowbys.length > 0) {
      fetchAndProcessData();
    } else {
      // Clear data if no knowbys are selected
      setDailyChartData([]);
      setMonthlyChartData([]);
      setFooterStats({});
    }
  }, [selectedKnowbys, chartType, effectiveEndDate, dailyChartStartDate, datesForDailyChart, monthsForMonthlyChart]); // Re-run when dependencies change

  // --- Knowby Selection Logic ---
  const handleKnowbyClick = (name: string) => {
    setSelectedKnowbys((prev) => {
      // Prevent unselecting the only knowby
      if (prev.length === 1 && prev[0] === name) {
        return prev; // Do nothing if it's the last selected knowby
      }
    
      // If the clicked knowby is already selected, unselect it
      if (prev.includes(name)) {
        return prev.filter((k) => k !== name);
      }

      // If chart type is daily (only one selection allowed)
      if (chartType === "daily") {
        return [name]; // Replace current selection with the new one
      }

      // If chart type is monthly (up to two selections allowed)
      if (chartType === "monthly") {
        if (prev.length < 2) {
          return [...prev, name];
        } else {
          // If 2 are already selected, and user clicks a new one, do nothing
          return prev;
        }
      }
      return prev; // Should not happen
    });
  };

  // Filter Knowbys for dropdown search
  const filteredKnowbys = knowbyOptions.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine graph title and colors
  let graphTitle = "";
  let knowby1Color = nivoColorSchemes.category10[0]; // Default for single/first knowby
  let knowby2Color = nivoColorSchemes.paired[1]; // Default for second knowby in comparison

  if (chartType === "daily") {
    const knowbyName = selectedKnowbys[0] || "Selected Knowby";
    graphTitle = `Views/Completions of ${knowbyName} over the Past 10 Days`;
  } else if (chartType === "monthly") {
    if (selectedKnowbys.length === 1) {
      const knowbyName = selectedKnowbys[0];
      graphTitle = `Completion Rate of ${knowbyName} over the Past 12 Months`;
    } else if (selectedKnowbys.length === 2) {
      const knowby1 = selectedKnowbys[0];
      const knowby2 = selectedKnowbys[1];
      graphTitle = `Completion Rate Comparison between ${knowby1} and ${knowby2} over the Past 12 Months`;
      // Assign Nivo's default colors for 'paired' scheme for consistency with lines
      knowby1Color = nivoColorSchemes.paired[0];
      knowby2Color = nivoColorSchemes.paired[1];
    } else {
      graphTitle = "Select Knowby(s) to Compare Completion Rate";
    }
  }

  // --- Utility for dynamic font sizing (simplified approach) ---
  const getDynamicFontSize = (text: string, baseSize: string, minSize: string, maxLength: number) => {
    if (text.length > maxLength) {
      return minSize; // Or calculate a more nuanced reduction
    }
    return baseSize;
  };

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        {/* Icon and Fixed Top Knowby Display */}
        <div className="flex items-start gap-4">
          {/* Icon container with fixed size */}
          <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center text-white">
            <TrendingUp className="h-10 w-10" />
          </div>

          {/* Text container that expands */}
          <div className="flex flex-col flex-grow overflow-hidden">
            <h3
              className="font-semibold truncate"
              style={{
                fontSize: getDynamicFontSize("Top Performing Knowby", "1.25rem", "1rem", 25)
              }}
              title="Top Performing Knowby"
            >
              Top Performing Knowby
            </h3>
            
            <div
              ref={knowbyContainerRef}
              className={cn(
                "font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap",
                "knowby-name-announcer"
              )}
              style={{
                fontSize: getDynamicFontSize(topKnowby, "2rem", "1.5rem", 20),
                maskImage: maskGradient,
                WebkitMaskImage: maskGradient,
              }}
              title={topKnowby}
            >
              <span
                key={animationKey}
                ref={knowbyTextRef}
                className={cn(
                  "inline-block",
                  needsScrolling ? "knowby-scroll-animate" : ""
                )}
                style={{
                  '--scroll-distance': scrollDistance,
                  animationPlayState: animationPlayState,
                } as React.CSSProperties}
              >
                {topKnowby}
              </span>
            </div>
          </div>
        </div>


        <hr className="border-border" />
        <CardContent className="pt-0">
        {/* Filters (unchanged from your original) */}
        <div className="flex flex-row gap-2 items-center w-1/2">
          {/* Chart Type Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "shadow-md w-full truncate relative flex justify-between items-center"
                  )}
                  title={chartType === "daily" ? "Views/Completions (10 days)" : "Completion Rate (12 Months)"}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
                    {chartType === "daily" ? "Views/Completions (10 days)" : "Completion Rate (12 Months)"}
                  </span>
                  <ChevronDown className="ml-2 transition-transform duration-200 h-4 w-4" />
                  <span className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setChartType("daily")}>Views/Completions (10 days)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setChartType("monthly")}>Completion Rate (12 Months)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu onOpenChange={setDropdownOpen} open={dropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "shadow-md w-full truncate relative flex justify-between items-center",
                    isDark ? "hover:bg-muted/50" : "hover:bg-accent"
                  )}
                  title={selectedKnowbys.length > 0 ? selectedKnowbys.join(", ") : "Select Knowby"}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
                    {selectedKnowbys.length > 0 ? selectedKnowbys.join(", ") : "Select Knowby"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-2 transition-transform duration-200 h-4 w-4",
                      dropdownOpen && "rotate-90"
                    )}
                  />
                  <span className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto p-2">
                <Input
                  placeholder="Search Knowby..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                {filteredKnowbys.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleKnowbyClick(name);
                    }}
                    className={cn(
                      "cursor-pointer",
                      selectedKnowbys.includes(name) && "bg-accent/50 font-semibold"
                    )}
                  >
                    <span className="flex justify-between w-full">
                      <span className="truncate">{name}</span>
                      {selectedKnowbys.includes(name) && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>


        {/* Graph Section (unchanged from your original) */}
          <div className="flex justify-between">
            <div className="h-[250px] flex-grow">
              {(chartType === "daily" && selectedKnowbys.length === 1 && dailyChartData.length > 0) ||
                (chartType === "monthly" && selectedKnowbys.length > 0 && monthlyChartData.length > 0) ? (
                <ResponsiveBar
                  data={
                    chartType === "daily"
                      ? dailyChartData
                      : monthsForMonthlyChart.map((month, index) => {
                        const entry: Record<string, any> = { month };
                        selectedKnowbys.forEach((knowby, idx) => {
                          const completionRate = monthlyChartData[idx]?.data[index]?.y ?? 0;
                          entry[knowby] = completionRate;
                        });
                        return entry;
                      })
                  }
                  keys={
                    chartType === "daily" ? ["Completions", "Views"] : selectedKnowbys
                  }
                  indexBy={chartType === "daily" ? "date" : "month"}
                  margin={{ top: 10, right: 30, bottom: 60, left: 50 }}
                  padding={0.4}
                  groupMode="grouped"
                  theme={nivoTheme}
                  colors={({ id }) => {
                    if (chartType === "daily") {
                      if (id === "Completions") return nivoColorSchemes.category10[0];
                      if (id === "Views") return nivoColorSchemes.category10[1];
                    } else {
                      if (id === selectedKnowbys[0]) return knowby1Color;
                      if (id === selectedKnowbys[1]) return knowby2Color;
                    }
                    return "#cccccc";
                  }}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -35,
                    legend: chartType === "monthly" ? "Month" : undefined,
                    legendPosition: "middle",
                    legendOffset: 45,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: chartType === "daily" ? "Count" : "Completion Rate (%)",
                    legendPosition: "middle",
                    legendOffset: -40,
                  }}
                  tooltip={({ id, value, indexValue }) => (
                    <div className="p-2 bg-background border rounded shadow-md">
                      <strong>{id}</strong>{" "}
                      {chartType === "daily" ? "on" : "in"} <strong>{indexValue}</strong>: {value}
                      {chartType === "monthly" ? "%" : ""}
                    </div>
                  )}
                  borderRadius={4}
                  enableLabel={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-center">
                  {selectedKnowbys.length === 0
                    ? "Select a Knowby to view data"
                    : chartType === "daily" && selectedKnowbys.length > 1
                      ? "Please select only one Knowby for Daily Views/Completions chart."
                      : "No data available for the selected period or knowby(s)."}
                </div>
              )}
            </div>
          {selectedKnowbys.length > 0 && (
            <div className="flex flex-col justify-center items-start ml-4">
              {selectedKnowbys.map((knowby, idx) => {
                const color = idx === 0 ? knowby1Color : knowby2Color;
                return (
                  <Tooltip key={knowby}>
                    <TooltipTrigger asChild>
                      <div
                        className="w-4 h-4 rounded-sm cursor-default"
                        style={{ backgroundColor: color }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="left">{knowby}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          </div>
          <p className="text-sm font-semibold mb-2">
            {chartType === "daily"
              ? "Views/Completions over the Past 10 Days"
              : selectedKnowbys.length === 2
                ? "Completion Rate Comparison over the Past 12 Months"
                : "Completion Rate over the Past 12 Months"}
          </p>
        </CardContent>

        {/* Footer Stats (unchanged from your original) */}
        <CardFooter className="flex items-center justify-between text-muted-foreground text-sm">
          {/* Views */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {selectedKnowbys.length === 2 && chartType === "monthly" ? (
                  <>
                    <span style={{ color: knowby1Color }}>
                      {footerStats[selectedKnowbys[0]]?.totalViews ?? "--"}
                    </span>
                    <span>-</span>
                    <span style={{ color: knowby2Color }}>
                      {footerStats[selectedKnowbys[1]]?.totalViews ?? "--"}
                    </span>
                  </>
                ) : selectedKnowbys.length >= 1 ? (
                  <span style={{ color: "inherit" /* default text color, no color */ }}>
                    {footerStats[selectedKnowbys[0]]?.totalViews ?? "--"}
                  </span>
                ) : (
                  <span>--</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {chartType === "monthly"
                ? "Total Views for selected Knowby(s) over the past 12 months"
                : "Total Views for selected Knowby(s) over the past 10 days"}
            </TooltipContent>
          </Tooltip>
              
          {/* Completions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                {selectedKnowbys.length === 2 && chartType === "monthly" ? (
                  <>
                    <span style={{ color: knowby1Color }}>
                      {footerStats[selectedKnowbys[0]]?.totalCompletions ?? "--"}
                    </span>
                    <span>-</span>
                    <span style={{ color: knowby2Color }}>
                      {footerStats[selectedKnowbys[1]]?.totalCompletions ?? "--"}
                    </span>
                  </>
                ) : selectedKnowbys.length >= 1 ? (
                  <span style={{ color: "inherit" }}>
                    {footerStats[selectedKnowbys[0]]?.totalCompletions ?? "--"}
                  </span>
                ) : (
                  <span>--</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {chartType === "monthly"
                ? "Total Completions for selected Knowby(s) over the past 12 months"
                : "Total Completions for selected Knowby(s) over the past 10 days"}
            </TooltipContent>
          </Tooltip>
              
          {/* Completion Rate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                {selectedKnowbys.length === 2 && chartType === "monthly" ? (
                  <>
                    <span style={{ color: knowby1Color }}>
                      {footerStats[selectedKnowbys[0]]?.completionRate !== null
                        ? `${footerStats[selectedKnowbys[0]]?.completionRate}%`
                        : "--%"}
                    </span>
                    <span>-</span>
                    <span style={{ color: knowby2Color }}>
                      {footerStats[selectedKnowbys[1]]?.completionRate !== null
                        ? `${footerStats[selectedKnowbys[1]]?.completionRate}%`
                        : "--%"}
                    </span>
                  </>
                ) : selectedKnowbys.length >= 1 ? (
                  <span style={{ color: "inherit" }}>
                    {footerStats[selectedKnowbys[0]]?.completionRate !== null
                      ? `${footerStats[selectedKnowbys[0]]?.completionRate}%`
                      : "--%"}
                  </span>
                ) : (
                  <span>--%</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {chartType === "monthly"
                ? "Completion Rate for selected Knowby(s) over the past 12 months"
                : "Completion Rate for selected Knowby(s) over the past 10 days"}
            </TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}