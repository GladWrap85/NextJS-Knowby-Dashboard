// components/Cards/InsightsCard.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  format,
  parse,
  isWithinInterval,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  eachWeekOfInterval,
  isSameWeek,
  isBefore,
  isAfter,
  addWeeks,
} from "date-fns";
import { ResponsiveLine } from "@nivo/line";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { getNivoTheme, useDarkMode } from "@/components/NivoWrapper";
import { Eye, CheckCircle, TrendingUp, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDateRange } from "@/lib/DateRangeContext";
import { Input } from "@/components/ui/input";

// Define Nivo color schemes for consistency
const nivoColorSchemes = {
  category10: [
    "#1f77b4", // Blue
    "#ff7f0e", // Orange
    "#2ca02c", // Green
    "#d62728", // Red
    "#9467bd", // Purple
    "#8c564b", // Brown
    "#e377c2", // Pink
    "#7f7f7f", // Gray
    "#bcbd22", // Olive
    "#17becf", // Cyan
  ],
  paired: [
    "#a6cee3",
    "#1f78b4",
    "#b2df8a",
    "#33a02c",
    "#fb9a99",
    "#e31a1c",
    "#fdbf6f",
    "#ff7f00",
    "#cab2d6",
    "#6a3d9a",
    "#ffff99",
    "#b15928",
  ],
};

type InsightsChartType = "overall" | "quarterly";
type QuarterlyMetric = "views" | "completions" | "completionRate";

interface OverallStats {
  totalViews: number;
  totalCompletions: number;
  totalKnowbys: number; // This count is of *distinct knowby_name values* found in the filtered data.
}

export default function InsightsCard() {
  const { dateRange } = useDateRange();
  const isDark = useDarkMode();
  const nivoTheme = getNivoTheme(isDark);

  const [chartType, setChartType] = useState<InsightsChartType>("quarterly");
  const [quarterlyTrendMetric, setQuarterlyTrendMetric] =
    useState<QuarterlyMetric>("completionRate");

  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [quarterlyChartData, setQuarterlyChartData] = useState<any[]>([]);

  // Knowby selection states (for quarterly trend - multi-select)
  const [allKnowbyNames, setAllKnowbyNames] = useState<string[]>([]); // Populated from completions/views.csv
  const [selectedKnowbys, setSelectedKnowbys] = useState<string[]>([]); // For quarterly, max 2
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [knowbyDropdownOpen, setKnowbyDropdownOpen] = useState(false);

  // New state for single Knowby selection (for overall performance)
  const [selectedKnowbyForOverall, setSelectedKnowbyForOverall] = useState<string | null>(null);
  const [overallKnowbyDropdownOpen, setOverallKnowbyDropdownOpen] = useState(false);
  const overallSearchInputRef = useRef<HTMLInputElement>(null);

  // Effective end date from the calendar or today
  const effectiveEndDate = dateRange?.to || new Date();

  // Handle Knowby selection for quarterly trend (multi-select, max 2)
  const handleKnowbyClick = useCallback((knowbyName: string) => {
    setSelectedKnowbys((prevSelected) => {
      if (prevSelected.includes(knowbyName)) {
        return prevSelected.filter((name) => name !== knowbyName);
      } else {
        if (prevSelected.length < 2) {
          return [...prevSelected, knowbyName];
        } else {
          // If already two selected, replace the older one with the new one
          return [prevSelected[1], knowbyName];
        }
      }
    });
  }, []);

  // Handle Knowby selection for overall performance (single-select)
  const handleSelectKnowbyForOverall = useCallback((knowbyName: string | null) => {
    setSelectedKnowbyForOverall(knowbyName);
    setOverallKnowbyDropdownOpen(false);
    setSearchTerm(""); // Clear search term after selection
  }, []);

  // Filtered Knowbys for the dropdown search
  const filteredKnowbys = allKnowbyNames.filter((name) =>
    typeof name === 'string' && name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const fetchAndProcessInsightsData = async () => {
      let allCompletions: any[] = [];
      let allViews: any[] = [];
      // let allKnowbysRaw: any[] = []; // No longer directly using knowbys.csv here

      await Promise.all([
        new Promise<void>((resolve) => {
          Papa.parse("/completions.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              allCompletions = results.data as any[];
              resolve();
            },
            error: (err) => {
                console.error("Error parsing completions.csv:", err);
                resolve(); // Still resolve to allow other parses to complete
            }
          });
        }),
        new Promise<void>((resolve) => {
          Papa.parse("/views.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              allViews = results.data as any[];
              resolve();
            },
            error: (err) => {
                console.error("Error parsing views.csv:", err);
                resolve();
            }
          });
        }),
      ]);

      // Populate allKnowbyNames from the loaded completions/views data
      const uniqueNamesFromCompletions = Array.from(new Set(allCompletions.map(row => typeof row.knowby_name === 'string' ? row.knowby_name : null))).filter(Boolean) as string[];
      const uniqueNamesFromViews = Array.from(new Set(allViews.map(row => typeof row.knowby_name === 'string' ? row.knowby_name : null))).filter(Boolean) as string[];

      const combinedUniqueKnowbyNames = Array.from(new Set([...uniqueNamesFromCompletions, ...uniqueNamesFromViews])).sort();
      setAllKnowbyNames(combinedUniqueKnowbyNames);
      // console.log("Combined unique knowby names:", combinedUniqueKnowbyNames); // Debugging line


      // --- Process Overall User Performance ---
      if (chartType === "overall") {
        let viewsForOverall = allViews;
        let completionsForOverall = allCompletions;

        if (selectedKnowbyForOverall) {
          viewsForOverall = allViews.filter(row => row.knowby_name === selectedKnowbyForOverall);
          completionsForOverall = allCompletions.filter(row => row.knowby_name === selectedKnowbyForOverall);
        }

        const totalViews = viewsForOverall.length;
        const totalCompletions = completionsForOverall.length;
        // Count unique knowby names from the filtered completions/views, not from a separate knowbys.csv
        const distinctKnowbysInOverallData = Array.from(new Set([
            ...viewsForOverall.map(row => row.knowby_name),
            ...completionsForOverall.map(row => row.knowby_name)
        ])).filter(Boolean).length;


        setOverallStats({ totalViews, totalCompletions, totalKnowbys: distinctKnowbysInOverallData });
      }

      // --- Process Quarterly Trend Data ---
      if (chartType === "quarterly") {
        if (selectedKnowbys.length === 0) {
          setQuarterlyChartData([]);
          return;
        }

        const filteredViews = allViews.filter((row) =>
          selectedKnowbys.includes(row.knowby_name)
        );
        const filteredCompletions = allCompletions.filter((row) =>
          selectedKnowbys.includes(row.knowby_name)
        );

        const currentQuarterStart = startOfQuarter(effectiveEndDate);
        const currentQuarterEnd = endOfQuarter(effectiveEndDate);
        const prevQuarterStart = startOfQuarter(subQuarters(effectiveEndDate, 1));
        const prevQuarterEnd = endOfQuarter(subQuarters(effectiveEndDate, 1));

        const currentQuarterWeeks: Date[] = [];
        let currentWeekIterator = startOfQuarter(currentQuarterStart);
        while (isBefore(currentWeekIterator, currentQuarterEnd) || isSameWeek(currentWeekIterator, currentQuarterEnd)) {
          currentQuarterWeeks.push(currentWeekIterator);
          currentWeekIterator = addWeeks(currentWeekIterator, 1);
        }

        const weekIndexMap = new Map<string, string>();
        currentQuarterWeeks.forEach((weekStart, index) => {
            weekIndexMap.set(format(weekStart, "yyyy-MM-dd"), `Week ${index + 1}`);
        });

        const quarterlyDataByKnowby: {
          [knowbyName: string]: {
            currentQuarter: Record<string, { views: number; completions: number }>;
            prevQuarter: Record<string, { views: number; completions: number }>;
          };
        } = {};

        selectedKnowbys.forEach((knowbyName) => {
          quarterlyDataByKnowby[knowbyName] = {
            currentQuarter: {},
            prevQuarter: {},
          };
          currentQuarterWeeks.forEach((weekStart) => {
            quarterlyDataByKnowby[knowbyName].currentQuarter[format(weekStart, "yyyy-MM-dd")] = { views: 0, completions: 0 };
          });
          eachWeekOfInterval({ start: prevQuarterStart, end: prevQuarterEnd }).forEach((weekStart) => {
              quarterlyDataByKnowby[knowbyName].prevQuarter[format(weekStart, "yyyy-MM-dd")] = { views: 0, completions: 0 };
          });
        });

        const getWeekKeyAndQuarter = (date: Date, knowbyName: string) => {
          if (isWithinInterval(date, { start: currentQuarterStart, end: currentQuarterEnd })) {
            const weekStart = currentQuarterWeeks.find((ws) =>
              isWithinInterval(date, { start: ws, end: addWeeks(ws, 1) })
            );
            return weekStart ? { key: format(weekStart, "yyyy-MM-dd"), quarter: "current" } : null;
          } else if (isWithinInterval(date, { start: prevQuarterStart, end: prevQuarterEnd })) {
            const prevQuarterExactWeeks = eachWeekOfInterval({start: prevQuarterStart, end: prevQuarterEnd});
            const weekStart = prevQuarterExactWeeks.find((ws) =>
                isWithinInterval(date, { start: ws, end: addWeeks(ws, 1) })
            );
            return weekStart ? { key: format(weekStart, "yyyy-MM-dd"), quarter: "prev" } : null;
          }
          return null;
        };


        filteredViews.forEach((row) => {
          const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
          if (row.knowby_name && quarterlyDataByKnowby[row.knowby_name]) {
            const info = getWeekKeyAndQuarter(rowDate, row.knowby_name);
            if (info) {
              if (info.quarter === "current") {
                quarterlyDataByKnowby[row.knowby_name].currentQuarter[info.key].views++;
              } else if (info.quarter === "prev") {
                quarterlyDataByKnowby[row.knowby_name].prevQuarter[info.key].views++;
              }
            }
          }
        });

        filteredCompletions.forEach((row) => {
          const rowDate = parse(row.date, "dd/MM/yyyy", new Date());
          if (row.knowby_name && quarterlyDataByKnowby[row.knowby_name]) {
            const info = getWeekKeyAndQuarter(rowDate, row.knowby_name);
            if (info) {
              if (info.quarter === "current") {
                quarterlyDataByKnowby[row.knowby_name].currentQuarter[info.key].completions++;
              } else if (info.quarter === "prev") {
                quarterlyDataByKnowby[row.knowby_name].prevQuarter[info.key].completions++;
              }
            }
          }
        });

        const chartSeries: any[] = [];
        selectedKnowbys.forEach((knowbyName, knowbyIndex) => {
          chartSeries.push({
            id: `${knowbyName} (Current Q)`,
            color: nivoColorSchemes.category10[knowbyIndex * 2 % nivoColorSchemes.category10.length],
            data: currentQuarterWeeks.map((weekStart) => {
              const key = format(weekStart, "yyyy-MM-dd");
              const dataPoint = quarterlyDataByKnowby[knowbyName]?.currentQuarter[key] || { views: 0, completions: 0 };
              let value = 0;
              if (quarterlyTrendMetric === "views") {
                value = dataPoint.views;
              } else if (quarterlyTrendMetric === "completions") {
                value = dataPoint.completions;
              } else if (quarterlyTrendMetric === "completionRate") {
                value =
                  dataPoint.views > 0
                    ? parseFloat(((dataPoint.completions / dataPoint.views) * 100).toFixed(2))
                    : 0;
              }
              return { x: weekIndexMap.get(key), y: value };
            }),
          });

          const prevQuarterExactWeeks = eachWeekOfInterval({start: prevQuarterStart, end: prevQuarterEnd});

          chartSeries.push({
            id: `${knowbyName} (Past Q)`,
            color: nivoColorSchemes.category10[(knowbyIndex * 2 + 1) % nivoColorSchemes.category10.length],
            data: currentQuarterWeeks.map((_, index) => {
                // Map to current quarter's week index for consistent x-axis display
                if (index >= prevQuarterExactWeeks.length) {
                    return { x: `Week ${index + 1}`, y: 0 };
                }
                const prevWeekKey = format(prevQuarterExactWeeks[index], "yyyy-MM-dd");
                const dataPoint = quarterlyDataByKnowby[knowbyName]?.prevQuarter[prevWeekKey] || { views: 0, completions: 0 };
                let value = 0;
                if (quarterlyTrendMetric === "views") {
                    value = dataPoint.views;
                } else if (quarterlyTrendMetric === "completions") {
                    value = dataPoint.completions;
                } else if (quarterlyTrendMetric === "completionRate") {
                    value =
                        dataPoint.views > 0
                            ? parseFloat(((dataPoint.completions / dataPoint.views) * 100).toFixed(2))
                            : 0;
                }
                return { x: `Week ${index + 1}`, y: value };
            }),
          });
        });

        setQuarterlyChartData(chartSeries);
      }
    };

    fetchAndProcessInsightsData();
  }, [chartType, quarterlyTrendMetric, effectiveEndDate, selectedKnowbys, selectedKnowbyForOverall]); // Dependencies look correct

  const getGraphTitle = useCallback(() => {
    if (chartType === "overall") {
      return "Overall User Performance";
    } else {
      let metricLabel = "";
      if (quarterlyTrendMetric === "views") metricLabel = "Views";
      if (quarterlyTrendMetric === "completions") metricLabel = "Completions";
      if (quarterlyTrendMetric === "completionRate") metricLabel = "Completion Rate";
      return `Knowby ${metricLabel} Trend: Current vs. Past Quarter`;
    }
  }, [chartType, quarterlyTrendMetric]);

  return (
    <Card className={`flex flex-col p-6 rounded-xl gap-3 col-span-2 ${ chartType === "overall" ? "h-fit" : "" }`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{getGraphTitle()}</h3>

        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-md">
                {chartType === "overall"
                  ? "Overall Performance"
                  : "Quarterly Trend"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setChartType("overall")}>
                Overall User Performance
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setChartType("quarterly")}>
                Knowby Current Quarter Trend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Single-select Knowby filter for Overall Performance */}
          {chartType === "overall" && (
            <DropdownMenu onOpenChange={setOverallKnowbyDropdownOpen} open={overallKnowbyDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "shadow-md max-w-[200px] truncate relative flex justify-between items-center",
                    isDark ? "hover:bg-muted/50" : "hover:bg-accent"
                  )}
                  title={selectedKnowbyForOverall || "All Knowbys"}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
                    {selectedKnowbyForOverall || "All Knowbys"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-2 transition-transform duration-200",
                      overallKnowbyDropdownOpen && "rotate-90"
                    )}
                  />
                  <span className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[250px] overflow-y-auto w-60 p-2">
                <Input
                  ref={overallSearchInputRef}
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
                    handleSelectKnowbyForOverall(null);
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
                      handleSelectKnowbyForOverall(name);
                    }}
                    className={cn(
                      "cursor-pointer",
                      selectedKnowbyForOverall === name && "bg-accent/50 font-semibold"
                    )}
                    title={name}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                      {name}
                    </span>
                    {selectedKnowbyForOverall === name && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                {filteredKnowbys.length === 0 && (
                  <div className="p-2 text-center text-muted-foreground">No matching Knowbys.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Multi-select Knowby filter for Quarterly Trend */}
          {chartType === "quarterly" && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="shadow-md">
                    {quarterlyTrendMetric === "views"
                      ? "Views"
                      : quarterlyTrendMetric === "completions"
                      ? "Completions"
                      : "Completion Rate"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setQuarterlyTrendMetric("views")}>
                    Views
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setQuarterlyTrendMetric("completions")}>
                    Completions
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setQuarterlyTrendMetric("completionRate")}>
                    Completion Rate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu onOpenChange={setKnowbyDropdownOpen} open={knowbyDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "shadow-md w-[180px] truncate relative flex justify-between items-center",
                      isDark ? "hover:bg-muted/50" : "hover:bg-accent"
                    )}
                    title={selectedKnowbys.length > 0 ? selectedKnowbys.join(", ") : "Select Knowby(s)"}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
                      {selectedKnowbys.length > 0 ? selectedKnowbys.join(", ") : "Select Knowby(s)"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "ml-2 transition-transform duration-200 h-4 w-4",
                        knowbyDropdownOpen && "rotate-90"
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
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="mb-2"
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
                      <span className="flex justify-between w-full items-center">
                        <span className="truncate">{name}</span>
                        {selectedKnowbys.includes(name) && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {filteredKnowbys.length === 0 && (
                    <div className="p-2 text-center text-muted-foreground">No matching Knowbys.</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <hr className="border-border" />

      <CardContent className="pt-4 flex-grow flex items-center justify-center">
        {chartType === "overall" && overallStats ? (
          <div className="grid grid-cols-3 gap-6 text-center w-full">
            <div className="flex flex-col items-center">
              <Eye className="h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-2xl font-bold">{overallStats.totalViews}</p>
            </div>
            <div className="flex flex-col items-center">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">Total Completions</p>
              <p className="text-2xl font-bold">{overallStats.totalCompletions}</p>
            </div>
            <div className="flex flex-col items-center">
              <TrendingUp className="h-8 w-8 text-purple-500 mb-2" />
              <p className="text-sm text-muted-foreground">Total Knowbys</p>
              <p className="text-2xl font-bold">{overallStats.totalKnowbys}</p>
            </div>
          </div>
        ) : chartType === "quarterly" && selectedKnowbys.length > 0 && quarterlyChartData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveLine
              data={quarterlyChartData}
              margin={{ top: 20, right: 110, bottom: 70, left: 60 }}
              xScale={{ type: "point" }}
              yScale={{
                type: "linear",
                min: "auto",
                max: "auto",
                stacked: false,
                reverse: false,
              }}
              yFormat=" >-.2f"
              curve="monotoneX"
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -45,
                legend: "Week of Quarter",
                legendOffset: 60,
                legendPosition: "middle",
                truncateTickAt: 0,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend:
                  quarterlyTrendMetric === "completionRate"
                    ? "Completion Rate (%)"
                    : quarterlyTrendMetric === "views"
                    ? "Views"
                    : "Completions",
                legendOffset: -50,
                legendPosition: "middle",
              }}
              pointSize={8}
              pointColor={{ theme: "background" }}
              pointBorderWidth={2}
              pointBorderColor={{ from: "serieColor" }}
              pointLabelYOffset={-12}
              enableTouchCrosshair={true}
              useMesh={true}
              theme={nivoTheme}
              colors={({ id }) => {
                const knowbyName = (id as string).split(' (')[0];
                const isCurrentQ = (id as string).includes('(Current Q)');
                const knowbyIndex = selectedKnowbys.indexOf(knowbyName);

                if (knowbyIndex === -1) return '#cccccc';

                return isCurrentQ
                  ? nivoColorSchemes.category10[knowbyIndex * 2 % nivoColorSchemes.category10.length]
                  : nivoColorSchemes.category10[(knowbyIndex * 2 + 1) % nivoColorSchemes.category10.length];
              }}
              legends={[
                {
                  anchor: "bottom-right",
                  direction: "column",
                  justify: false,
                  translateX: 100,
                  translateY: 0,
                  itemsSpacing: 0,
                  itemDirection: "left-to-right",
                  itemWidth: 90,
                  itemHeight: 20,
                  itemOpacity: 0.75,
                  symbolSize: 12,
                  symbolShape: "circle",
                  symbolBorderColor: "rgba(0, 0, 0, .5)",
                  effects: [
                    {
                      on: "hover",
                      style: {
                        itemBackground: "rgba(0, 0, 0, .03)",
                        itemOpacity: 1,
                      },
                    },
                  ],
                },
              ]}
              tooltip={({ point }) => (
                <div className="p-2 bg-background border rounded shadow-md text-sm">
                  <strong>{point.seriesId as string}</strong>
                  <br />
                  {point.data.xFormatted}:{" "}
                  <strong>
                    {point.data.yFormatted}{quarterlyTrendMetric === "completionRate" ? "%" : ""}
                  </strong>
                </div>
              )}
            />
          </div>
        ) : chartType === "quarterly" && selectedKnowbys.length === 0 ? (
          <div className="text-muted-foreground text-center">
            Select one or two Knowbys to view quarterly trend data.
          </div>
        ) : (
          <div className="text-muted-foreground text-center">
            No data available for the selected period or knowby(s).
          </div>
        )}
      </CardContent>
    </Card>
  );
}