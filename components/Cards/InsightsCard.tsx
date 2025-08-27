// components/Cards/InsightsCard.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Papa from "papaparse";
import { ResponsiveBar } from '@nivo/bar';
import {
  parse as dateParse,
  isAfter,
  subDays,
  subQuarters,
  subYears,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  endOfWeek,
  endOfMonth,
  isWithinInterval
} from 'date-fns';
import { Check, ChevronDown, Eye, CheckCircle, TrendingUp, Search } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getNivoTheme, useDarkMode } from "@/components/NivoWrapper";
import { Input } from "@/components/ui/input";

declare module 'react' {
  interface CSSProperties {
    '--card-background'?: string;
  }
}

// --- TYPE DEFINITIONS & CONSTANTS ---
type ViewMode = 'overview' | 'filteredGraph';
type StatType = 'views' | 'completions' | 'completionRate' | 'viewsAndCompletions';
type TimeFrame = '7d' | '3m' | '1y';

interface OverallStats {
  totalViews: number;
  totalCompletions: number;
  completionRate: number;
}

interface DropdownOption<T> {
  value: T;
  label: string;
}

const STAT_OPTIONS: DropdownOption<StatType>[] = [
  { value: 'views', label: 'Views' },
  { value: 'completions', label: 'Completions' },
  { value: 'completionRate', label: 'Completion Rate' },
  { value: 'viewsAndCompletions', label: 'Views & Completions' },
];

const TIME_FRAME_OPTIONS: DropdownOption<TimeFrame>[] = [
  { value: '7d', label: 'Past 7 Days' },
  { value: '3m', label: 'Past Quarter' },
  { value: '1y', label: 'Past Year' },
];

const KNOWBY_COLORS = {
  knowby1: { base: '#3b82f6', light: '#93c5fd' }, // Blue
  knowby2: { base: '#f97316', light: '#fdba74' }  // Orange
};

const CustomDropdown = <T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: DropdownOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedLabel = options.find(opt => opt.value === selected)?.label || 'Select';

  return (
    <div
      className={cn(
        'transition-opacity duration-300 pb-4',
        disabled ? 'opacity-40 pointer-events-none' : 'opacity-100'
      )}
    >
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <DropdownMenu onOpenChange={(open) => setDropdownOpen(open)} open={dropdownOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          {/* 3 lines below shadow-md w-[200px]: to make it expandable do max-2-[200px]*/}
          <Button
            variant="outline"
            className={cn(
              "shadow-md w-[170px] truncate relative flex justify-between items-center",
              "hover:bg-accent dark:hover:bg-muted/50"
            )}
            title={selectedLabel}
          >
            {/* Truncated label */}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-4">
              {selectedLabel}
            </span>

            {/* Chevron with rotation */}
            <ChevronDown
              className={cn(
                "ml-2 h-4 w-4 transition-transform duration-200 shrink-0",
                dropdownOpen && "rotate-90"
              )}
            />

            {/* Fade overlay */}
            <span className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="max-h-[250px] overflow-y-auto w-60 p-2">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value as string}
              onSelect={(e) => {
                e.preventDefault();
                onSelect(option.value);
              }}
              title={option.label}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                {option.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default function InsightsCard() {
  const isDark = useDarkMode();
  const nivoTheme = getNivoTheme(isDark);

  // --- STATE MANAGEMENT ---
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedKnowbys, setSelectedKnowbys] = useState<string[]>([]);
  const [selectedStat, setSelectedStat] = useState<StatType>('completionRate');
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('3m');

  const [allCompletions, setAllCompletions] = useState<any[]>([]);
  const [allViews, setAllViews] = useState<any[]>([]);
  const [allKnowbyNames, setAllKnowbyNames] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [chartKeys, setChartKeys] = useState<string[]>([]);

  const isFilteredGraphMode = viewMode === 'filteredGraph';
  const chartRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING & INITIALIZATION ---
  useEffect(() => {
    const fetchData = async () => {
      const completionsPromise = new Promise<any[]>((resolve) => {
        Papa.parse("/completions.csv", {
          download: true, header: true, skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => { console.error("Error parsing completions.csv:", err); resolve([]); }
        });
      });

      const viewsPromise = new Promise<any[]>((resolve) => {
        Papa.parse("/views.csv", {
          download: true, header: true, skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => { console.error("Error parsing views.csv:", err); resolve([]); }
        });
      });

      const [completionsData, viewsData] = await Promise.all([completionsPromise, viewsPromise]);
      setAllCompletions(completionsData);
      setAllViews(viewsData);

      const uniqueNames = Array.from(new Set([
        ...completionsData.map(row => row.knowby_name),
        ...viewsData.map(row => row.knowby_name)
      ])).filter(Boolean).sort() as string[];
      setAllKnowbyNames(uniqueNames);
    };
    fetchData();
  }, []);

  // --- DATA PROCESSING LOGIC ---
  useEffect(() => {
    if (allViews.length === 0 && allCompletions.length === 0) return;

    const parseCsvDate = (dateStr: string) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const parsed = dateParse(dateStr, "dd/MM/yyyy", new Date());
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    let currentSelectedKnowbys = selectedKnowbys;
    if (isFilteredGraphMode && selectedKnowbys.length === 0 && allKnowbyNames.length > 0) {
      currentSelectedKnowbys = [allKnowbyNames[0]];
      setSelectedKnowbys(currentSelectedKnowbys);
    }

    const dataToProcessViews = currentSelectedKnowbys.length > 0
      ? allViews.filter(v => currentSelectedKnowbys.includes(v.knowby_name))
      : allViews;
    const dataToProcessCompletions = currentSelectedKnowbys.length > 0
      ? allCompletions.filter(c => currentSelectedKnowbys.includes(c.knowby_name))
      : allCompletions;

    // Calculate overall stats (for overview mode)
    const totalViews = dataToProcessViews.length;
    const totalCompletions = dataToProcessCompletions.length;
    setOverallStats({
      totalViews,
      totalCompletions,
      completionRate: totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0,
    });

    // Generate chart data if in filtered mode
    if (isFilteredGraphMode && currentSelectedKnowbys.length > 0) {
      const now = new Date();
      let startDate: Date;
      let intervals: { start: Date; end: Date; label: string }[] = [];

      switch (selectedTimeFrame) {
        case '7d':
          startDate = subDays(now, 6);
          intervals = eachDayOfInterval({ start: startDate, end: now }).map(day => ({
            start: startOfDay(day), end: endOfDay(day), label: format(day, 'MMM d')
          }));
          break;
        case '3m':
          startDate = subQuarters(now, 1);
          intervals = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 1 }).map(weekStart => ({
            start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }), label: format(weekStart, "'Wk' w")
          }));
          break;
        case '1y':
          startDate = subYears(now, 1);
          intervals = eachMonthOfInterval({ start: startDate, end: now }).map(monthStart => ({
            start: monthStart, end: endOfMonth(monthStart), label: format(monthStart, 'MMM yyyy')
          }));
          break;
      }

      const newKeys: string[] = [];
      currentSelectedKnowbys.forEach(name => {
        if (selectedStat === 'views') newKeys.push(`${name} Views`);
        if (selectedStat === 'completions') newKeys.push(`${name} Completions`);
        if (selectedStat === 'completionRate') newKeys.push(`${name} Completion Rate`);
        if (selectedStat === 'viewsAndCompletions') {
          newKeys.push(`${name} Views`);
          newKeys.push(`${name} Completions`);
        }
      });
      setChartKeys(newKeys);

      const newBarData = intervals.map(interval => {
        const intervalData: { [key: string]: any } = { interval: interval.label };

        currentSelectedKnowbys.forEach(knowbyName => {
          const viewsInInterval = dataToProcessViews.filter(v => {
            const date = parseCsvDate(v.date);
            return v.knowby_name === knowbyName && date && isWithinInterval(date, { start: interval.start, end: interval.end });
          }).length;
          const completionsInInterval = dataToProcessCompletions.filter(c => {
            const date = parseCsvDate(c.date);
            return c.knowby_name === knowbyName && date && isWithinInterval(date, { start: interval.start, end: interval.end });
          }).length;
          const rate = viewsInInterval > 0 ? Math.round((completionsInInterval / viewsInInterval) * 100) : 0;

          if (newKeys.includes(`${knowbyName} Views`)) intervalData[`${knowbyName} Views`] = viewsInInterval;
          if (newKeys.includes(`${knowbyName} Completions`)) intervalData[`${knowbyName} Completions`] = completionsInInterval;
          if (newKeys.includes(`${knowbyName} Completion Rate`)) intervalData[`${knowbyName} Completion Rate`] = rate;
        });
        return intervalData;
      });

      setBarChartData(newBarData);
    } else {
      setBarChartData([]);
      setChartKeys([]);
    }

  }, [viewMode, selectedKnowbys, selectedStat, selectedTimeFrame, allViews, allCompletions, allKnowbyNames, isFilteredGraphMode]);

  // --- EVENT HANDLERS ---
  const handleKnowbySelection = (knowbyName: string) => {
    if (isFilteredGraphMode) {
      const newSelection = selectedKnowbys.includes(knowbyName)
        ? selectedKnowbys.filter(name => name !== knowbyName)
        : selectedKnowbys.length < 2
          ? [...selectedKnowbys, knowbyName]
          : selectedKnowbys;
      setSelectedKnowbys(newSelection);
    } else {
      setSelectedKnowbys(selectedKnowbys.includes(knowbyName) ? [] : [knowbyName]);
    }
  };

  const handleAllKnowbysSelection = () => {
    if (viewMode === 'overview') {
      setSelectedKnowbys([]);
    }
  };

  const filteredKnowbyNames = useMemo(() => {
    return allKnowbyNames.filter(name =>
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allKnowbyNames, searchQuery]);

  // --- DYNAMIC CHART PROPERTIES ---
  const chartTitle = useMemo(() => {
    if (!isFilteredGraphMode || selectedKnowbys.length === 0) return '';
    const statLabel = STAT_OPTIONS.find(s => s.value === selectedStat)?.label || '';
    const timeFrameLabel = TIME_FRAME_OPTIONS.find(t => t.value === selectedTimeFrame)?.label || '';
    const knowbyNames = selectedKnowbys.join(' vs ');
    return `${statLabel} for ${knowbyNames} over the ${timeFrameLabel}`;
  }, [isFilteredGraphMode, selectedKnowbys, selectedStat, selectedTimeFrame]);

  const axisLeftLegend = useMemo(() => {
    if (selectedStat === 'viewsAndCompletions') return 'Count';
    return STAT_OPTIONS.find(s => s.value === selectedStat)?.label || 'Value';
  }, [selectedStat]);

  const axisBottomLegend = useMemo(() => {
    if (!isFilteredGraphMode) return '';
    switch (selectedTimeFrame) {
      case '7d': return 'Day';
      case '3m': return 'Week';
      case '1y': return 'Month';
      default: return 'Interval';
    }
  }, [isFilteredGraphMode, selectedTimeFrame]);

  const getColor = (bar: any) => {
    const knowby1Name = selectedKnowbys[0];
    const knowby2Name = selectedKnowbys.length > 1 ? selectedKnowbys[1] : null;

    if (selectedStat === 'viewsAndCompletions') {
      if (bar.id.startsWith(knowby1Name)) {
        return bar.id.includes('Views') ? KNOWBY_COLORS.knowby1.base : KNOWBY_COLORS.knowby1.light;
      }
      if (knowby2Name && bar.id.startsWith(knowby2Name)) {
        return bar.id.includes('Views') ? KNOWBY_COLORS.knowby2.base : KNOWBY_COLORS.knowby2.light;
      }
    } else {
      if (bar.id.startsWith(knowby1Name)) return KNOWBY_COLORS.knowby1.base;
      if (knowby2Name && bar.id.startsWith(knowby2Name)) return KNOWBY_COLORS.knowby2.base;
    }
    return '#ccc'; // Fallback
  };

  // --- RENDER LOGIC ---
  const renderContent = () => {
    if (viewMode === 'overview') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center w-full py-8">
          <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <Eye className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-muted-foreground">Total Views</p>
            <p className="text-3xl font-bold">{overallStats?.totalViews ?? 0}</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">Total Completions</p>
            <p className="text-3xl font-bold">{overallStats?.totalCompletions ?? 0}</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <TrendingUp className="h-8 w-8 text-purple-500 mb-2" />
            <p className="text-sm text-muted-foreground">Completion Rate</p>
            <p className="text-3xl font-bold">{overallStats?.completionRate ?? 0}%</p>
          </div>
        </div>
      );
    }

    if (viewMode === 'filteredGraph') {
      if (!barChartData || barChartData.length === 0 || chartKeys.length === 0) {
        return (
          <div className="flex items-center justify-center h-[350px] text-gray-500">
            <p>Please select a Knowby to display data.</p>
          </div>
        );
      }

      return (
        <div className="h-[300px] w-full flex flex-col">
          <div className="flex justify-between h-full">
            <div className="flex-grow">
              <ResponsiveBar
                data={barChartData}
                keys={chartKeys}
                indexBy="interval"
                margin={{ top: 20, right: 30, bottom: 40, left: 50 }}
                padding={0.3}
                groupMode="grouped"
                valueScale={{
                  type: 'linear',
                  min: 0,
                  max: selectedStat === 'completionRate' ? 100 : 'auto',
                }}
                indexScale={{ type: 'band', round: true }}
                colors={getColor}
                theme={nivoTheme}
                borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: -15,
                  legend: '',
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: '',
                  format: value =>
                    selectedStat === 'completionRate' ? `${value}%` : value,
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                tooltip={({ id, value }) => (
                  <div className="px-2 py-1 bg-white dark:bg-gray-800 shadow-md rounded-md text-sm">
                    {id}: {value}
                  </div>
                )}
                animate={true}
              />
            </div>

            {/* Custom legend: swatches only, label shown via tooltip on hover */}
            {chartKeys.length > 0 && (
              <TooltipProvider delayDuration={100}>
                <div className="flex flex-col justify-center items-start ml-4 space-y-2">
                  {chartKeys.map((key) => (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <div
                          className="w-4 h-4 rounded-sm cursor-default"
                          style={{ backgroundColor: getColor({ id: key }) }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="left">{key}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            )}
          </div>

          {chartTitle && (
            <h3 className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0">
              {chartTitle}
            </h3>
          )}
        </div>
      );
    }

    return null;
  };


  return (
    <Card className="p-6 rounded-xl shadow-lg col-span-2">
      {/* Card Header and View Mode Toggle. mb for shorten space below line and pb for space above line (mb-4 pb 4 default) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-0 border-b border-gray-200 dark:border-gray-700 pb-2">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Performance Insights</h2>
        <div className="mt-3 sm:mt-0 flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${viewMode === 'overview' ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            User Performance Overview
          </button>
          <button
            onClick={() => setViewMode('filteredGraph')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${viewMode === 'filteredGraph' ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            Filtered Graph
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Knowby Selection */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Knowby Modules {isFilteredGraphMode ? '(Select up to 2)' : ''}
          </label>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search Knowbys..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Change height of filters on the line below h-[px] (default 300px)*/}
          <div className="relative h-[130px] overflow-hidden">
            <div className="h-full overflow-y-auto pr-2">
              <div className="flex flex-wrap gap-2">
                {viewMode === 'overview' && (
                  <button
                    key="all-knowbys"
                    onClick={handleAllKnowbysSelection}
                    className={`flex items-center px-3 py-1.5 text-sm rounded-full transition-all duration-200 border ${selectedKnowbys.length === 0
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    {selectedKnowbys.length === 0 && <Check className="w-4 h-4 mr-1.5" />}
                    All Knowbys
                  </button>
                )}

                {filteredKnowbyNames.map(name => (
                  <button
                    key={name}
                    onClick={() => handleKnowbySelection(name)}
                    className={`flex items-center px-3 py-1.5 text-sm rounded-full transition-all duration-200 border ${selectedKnowbys.includes(name)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    {selectedKnowbys.includes(name) && <Check className="w-4 h-4 mr-1.5" />}
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-12 pointer-events-none"
              style={{
                background: 'linear-gradient(to top, var(--card-background) 0%, transparent 100%)',
                '--card-background': isDark ? '#020817' : '#FFFFFF'
              } as React.CSSProperties}
            ></div>
          </div>
        </div>

        {/* Stat Selection */}
        <CustomDropdown
          label="Statistic"
          options={STAT_OPTIONS}
          selected={selectedStat}
          onSelect={(val) => setSelectedStat(val as StatType)}
          disabled={!isFilteredGraphMode}
        />

        {/* Time Frame Selection */}
        <CustomDropdown
          label="Time Frame"
          options={TIME_FRAME_OPTIONS}
          selected={selectedTimeFrame}
          onSelect={(val) => setSelectedTimeFrame(val as TimeFrame)}
          disabled={!isFilteredGraphMode}
        />
      </div>

      {/* Chart/Content Area (Default pt2 mt2)*/}
      <CardContent className="pt-0 mt-0 border-t border-gray-200 dark:border-gray-700">
        {renderContent()}
      </CardContent>
    </Card>
  );
}