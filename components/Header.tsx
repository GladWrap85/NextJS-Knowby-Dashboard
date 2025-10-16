'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BellIcon, CheckCircle, FileDown, Loader2, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { CommandDemo } from "./Command";
import { Button } from "./ui/button";
import { DatePickerWithRange } from "./DateRangePicker";
import { ModeToggle } from "./ThemeSwitch";
import { toast } from 'sonner'
import { useDateRange } from "@/lib/DateRangeContext"; 
import { useSidebar } from "./Sidebar-Context";
import { ChevronFirst, ChevronLast } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { cn } from "@/lib/utils";


export default function Header() {
  // Use the useDateRange hook to get the global date state and setter
  const { dateRange, setDateRange } = useDateRange();
  const { expanded, toggle } = useSidebar()


  const { reload, completions, views } = useKnowbyData();

  // scraper state
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperSuccess, setScraperSuccess] = useState(false);

  // handleRunScraper: triggers the scraper API and manages loading/success state
  const handleRunScraper = async () => {
    setScraperLoading(true);
    setScraperSuccess(false);
    try {
      const response = await fetch("/api/run-scraper", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
      setScraperSuccess(true);
      toast.success('Scraper ran successfully!'); 
      reload(); // refresh data in the app
      setTimeout(() => setScraperSuccess(false), 2000);
    } else {
      console.error("Scraper failed:", data.message);
      toast.error(data.message || 'Failed to refresh data. Please Update Headers.'); 
    }
  } catch (err) {
    console.error("Error running scraper:", err);
    toast.error('An unexpected error occurred during refresh.'); 
  } finally {
    setScraperLoading(false);
  }
};

  // Exports the current dashboard as a PDF.
  // We use a dynamic import so the PDF code only loads when the user actually clicks Export (saves bundle size).
  const handleExport = async () => {
    try {
      const { exportDashboardPdf } = await import("@/lib/manualDashboardRenderer");
      exportDashboardPdf(completions, views, dateRange);
      toast.success("PDF exported");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className="sticky top-0 z-50 grid grid-cols-2 items-center gap-4 px-3 h-12 backdrop-blur-md shadow-md">
      <div className="flex items-center">
        <Button className="relative cursor-pointer w-8 h-8 hover:!bg-accent dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent" onClick={toggle} variant={"outline"} size="icon">
          {expanded ? <ChevronFirst /> : <ChevronLast />}
        </Button>
        <span className="text-xl font-bold pl-4">Dashboard</span>
      </div>
      <div className="flex items-center justify-end gap-[12px] pr-4">
        <Button
          onClick={handleRunScraper}
          disabled={scraperLoading}
          className={cn(
            "gap-2 w-[120px] justify-center text-white transition-colors duration-300 cursor-pointer",
            scraperLoading || scraperSuccess
              ? "pointer-events-none opacity-90"
              : "",
            scraperSuccess
              ? "bg-gradient-to-br from-green-600 to-green-400"
              : "bg-gradient-to-br from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600"
          )}
        >
          {scraperLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : scraperSuccess ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          <span className="text-sm">
            {scraperLoading ? "Running..." : scraperSuccess ? "Success!" : "Refresh"}
          </span>
        </Button>

        {/* Export button: uses dynamic import + pulls data from context */}
        <Button
          onClick={handleExport}
          variant="outline"
          className="gap-2 cursor-pointer dark:hover:text-white"
          title="Export current view as PDF"
        >
          <FileDown className="h-4 w-4" />
          <span className="text-sm">Export</span>
        </Button>

        
        <DropdownMenu>
          {/* Pass the dateRange and setDateRange from context to DatePickerWithRange */}
          {/* <DatePickerWithRange
            date={dateRange}
            onSelect={setDateRange}
          /> */}
          <DropdownMenuTrigger asChild>
          </DropdownMenuTrigger>
          <ModeToggle />
        </DropdownMenu>
      </div>
    </div>
  );
}