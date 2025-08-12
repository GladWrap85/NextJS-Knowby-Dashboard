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
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });


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
    const monthlyCounts: Record<string, { completions: number; views: number }> = {};

    const processData = () => {
      Papa.parse("/completions.csv", {
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

          Papa.parse("/views.csv", {
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

  const nonZeroViews = monthlyData.map(d => d.Views).filter(v => v > 0);
  const nonZeroCompletions = monthlyData.map(d => d.Completions).filter(v => v > 0);

  const viewsAverage =
    nonZeroViews.length > 0
      ? nonZeroViews.reduce((sum, v) => sum + v, 0) / nonZeroViews.length
      : 0;

  const completionsAverage =
    nonZeroCompletions.length > 0
      ? nonZeroCompletions.reduce((sum, v) => sum + v, 0) / nonZeroCompletions.length
      : 0;


  // Turn "YYYY-MM" into a timestamp at the 1st of the month
  const toTs = (ym: string) => new Date(`${ym}-01T00:00:00`).getTime();

  const series = [
    {
      name: "Views",
      data: monthlyData.map(d => ({ x: toTs(d.month), y: d.Views })),
    },
    {
      name: "Completions",
      data: monthlyData.map(d => ({ x: toTs(d.month), y: d.Completions })),
    },
  ];


  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    markers: { size: 0 },
    xaxis: {
      type: "datetime",
      tickAmount: 6,
      labels: { datetimeUTC: false,
        rotate: -30,
        format: "MMM yyyy",
        style: {
          colors: isDark ? '#aaa' : ''
        }
      },
      
    },
    yaxis: {
      tickAmount: 4,
      labels: { formatter: (v) => `${Math.round(v)}`,
        style: {
          colors: isDark ? '#aaa' : ''
        }
    },
    },
    tooltip: {
      shared: true,
      x: { format: "MMM yyyy" },
      theme: isDark ? 'dark' : 'light',
    },
    grid: { 
      strokeDashArray: 2,
      borderColor: '#aaa'
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.4,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    legend: { 
      position: "top",
      floating: true,
      labels: {
        colors: isDark ? '#aaa' : ''
      }
    },
  };




  
  return (
    <TooltipProvider>
      <Card className="flex flex-col p-6 rounded-xl h-fit gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-15 h-15 rounded-lg text-white bg-gradient-to-b from-green-500 to-green-700">
            <TrendingUp className="h-8 w-8" />
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Total Usage</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold leading-none">{roundedDisplayRate}</div>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </div>
          </div>
        </div>

        <hr className="border-border" />

        <CardContent className="p-0">

          <div className="h-[145px]">
            <ReactApexChart options={options} series={series} type="area" height={150} />
          </div>
        </CardContent>
        <div className="pl-6 pr-6">
          <div className="flex justify-center">
          <p className="text-xs font-semibold">Completions vs Views per Month</p>
          </div>
          <CardFooter className="flex items-center justify-between text-muted-foreground text-sm px-0 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">{totalViews}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Views</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">{totalCompletions}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total Completions</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">{preciseDisplayRate}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion Rate</TooltipContent>
            </Tooltip>
          </CardFooter>
        </div>
      </Card>
    </TooltipProvider>
  );
}
