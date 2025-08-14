// components/Cards/TotalUsageCard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function TotalUsageCard() {
  const [completionRate, setCompletionRate] = useState<number | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [selectedKnowby, setSelectedKnowby] = useState<string | null>(null);
  const [knowbyOptions, setKnowbyOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isDark = useDarkMode();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Papa.parse("/scrapercompletions.csv", {
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
    const monthlyCounts: Record<string, { completions: number; views: number }> = {};

    const processData = () => {
      Papa.parse("/scrapercompletions.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (compResults) => {
          const completions = compResults.data as any[];

          completions.forEach((row) => {
            if (!row.date || (selectedKnowby && row.knowby_name !== selectedKnowby)) return;
            const date = parseDate(row.date);
            const key = formatMonth(date);
            if (!monthlyCounts[key]) monthlyCounts[key] = { completions: 0, views: 0 };
            monthlyCounts[key].completions++;
          });

          Papa.parse("/scraperviews.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (viewResults) => {
              const views = viewResults.data as any[];

              views.forEach((row) => {
                if (!row.date || (selectedKnowby && row.knowby_name !== selectedKnowby)) return;
                const date = parseDate(row.date);
                const key = formatMonth(date);
                if (!monthlyCounts[key]) monthlyCounts[key] = { completions: 0, views: 0 };
                monthlyCounts[key].views++;
              });

              const data = Object.entries(monthlyCounts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, { completions, views }]) => ({
                  month,
                  Completions: completions,
                  Views: views,
                }));

              const totalCompletions = data.reduce((sum, d) => sum + d.Completions, 0);
              const totalViews = data.reduce((sum, d) => sum + d.Views, 0);

              setMonthlyData(data);
              if (totalViews > 0) {
                setCompletionRate((totalCompletions / totalViews) * 100);
              } else {
                setCompletionRate(null);
              }
            },
          });
        },
      });
    };

    processData();
  }, [selectedKnowby]);

  const filteredKnowbys = knowbyOptions.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [dropdownOpen]);

  const handleSelect = (name: string | null) => {
    setSelectedKnowby(name);
    setDropdownOpen(false);
  };

  const totalCompletions = monthlyData.reduce((sum, d) => sum + d.Completions, 0);
  const totalViews = monthlyData.reduce((sum, d) => sum + d.Views, 0);

  const roundedDisplayRate =
    completionRate !== null ? `${Math.round(completionRate)}%` : "--";
  const preciseDisplayRate =
    completionRate !== null ? `${completionRate.toFixed(2)}%` : "--";

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl text-white bg-gradient-to-b from-green-500 to-green-700">
            <TrendingUp className="h-10 w-10" />
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Total Usage</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-bold leading-none">{roundedDisplayRate}</div>
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

          <div style={{ height: 250 }}>
            <ResponsiveBar
              data={monthlyData}
              keys={["Completions", "Views"]}
              indexBy="month"
              margin={{ top: 10, right: 30, bottom: 40, left: 50 }}
              padding={0.4}
              groupMode="grouped"
              theme={getNivoTheme(isDark)}
              colors={{ scheme: "category10" }}
              axisBottom={{ tickRotation: -45 }}
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
                  <strong>{id}</strong> in <strong>{indexValue}</strong>: {value}
                </div>
              )}
              borderRadius={4}
              enableLabel={false}
            />
          </div>

          <div className="pt-4">
            <p className="text-sm font-semibold">Completions vs Views per Month</p>
            <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    <span>{totalViews}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Views</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    <span>{totalCompletions}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Completions</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    <span>{preciseDisplayRate}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Completion Rate</TooltipContent>
              </Tooltip>
            </CardFooter>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
