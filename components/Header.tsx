'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BellIcon, CheckCircle, Loader2, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { CommandDemo } from "./Command";
import { Button } from "./ui/button";
import { DatePickerWithRange } from "./DateRangePicker";
import { ModeToggle } from "./ThemeSwitch";
// No need to import DateRange or addDays here directly if only DatePickerWithRange uses them
// but we will import useDateRange hook
import { useDateRange } from "@/lib/DateRangeContext"; // Import the custom hook
import { useSidebar } from "./Sidebar-Context";
import { ChevronFirst, ChevronLast } from "lucide-react";
import { useKnowbyData } from "@/lib/KnowbyDataProvider";
import { cn } from "@/lib/utils";

// No longer needs HeaderProps interface as it will consume context
export default function Header() {
  // Use the useDateRange hook to get the global date state and setter
  const { dateRange, setDateRange } = useDateRange();
  const { expanded, toggle } = useSidebar()
  const [notifications, setNotifications] = useState<any>([
    {
      text: "This is a notification",
      date: "02-01-2015",
      read: true
    },
    {
      text: "This is another notification",
      date: "02-01-2015",
      read: false
    }
  ])

  const { reload } = useKnowbyData();

  // NEW: scraper state (moved from Sidebar)
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperSuccess, setScraperSuccess] = useState(false);

  // NEW: same behavior the Sidebar used
  const handleRunScraper = async () => {
    setScraperLoading(true);
    setScraperSuccess(false);
    try {
      const response = await fetch("/api/run-scraper", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setScraperSuccess(true);
        reload(); // refresh data in the app
        setTimeout(() => setScraperSuccess(false), 2000);
      } else {
        console.error("Scraper failed:", data.message);
      }
    } catch (err) {
      console.error("Error running scraper:", err);
    } finally {
      setScraperLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-2 border-b bg-sidebar shadow-gray-300/20 dark:shadow-gray-800/20 shadow-xl">
      <div className="flex items-center">
        <Button className="relative w-8 h-8 hover:!bg-accent dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent" onClick={toggle} variant={"outline"} size="icon">
          {expanded ? <ChevronFirst /> : <ChevronLast />}
        </Button>
        <span className="text-xl font-bold pl-4">Dashboard</span>
      </div>
      <div className="flex items-center justify-end gap-[32px] pr-4">
        <Button
          onClick={handleRunScraper}
          disabled={scraperLoading}
          className={cn(
            "gap-2 w-[120px] justify-center text-white transition-colors duration-300",
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

        
        <DropdownMenu>
          {/* Pass the dateRange and setDateRange from context to DatePickerWithRange */}
          {/* <DatePickerWithRange
            date={dateRange}
            onSelect={setDateRange}
          /> */}
          <DropdownMenuTrigger asChild>
            <Button className="relative hover:!bg-accent w-8 h-8 dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent" variant="outline" size="icon">
              <div className={`absolute -top-2 -right-1 h-3 w-3 rounded-full my-1 ${notifications.find((x: any) => x.read === true) ? 'bg-green-500' : 'bg-neutral-200'}`}></div>
              <BellIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <ModeToggle />
          <DropdownMenuContent align="end">
            {notifications.map((item: any, key: number) => (
              <DropdownMenuItem key={key} className="py-2 px-3 cursor-pointer hover:bg-neutral-50 transition flex items-start gap-2">
                <div className={`h-3 w-3 rounded-full my-1 ${!item.read ? 'bg-green-500' : 'bg-neutral-200'}`}></div>
                <div>
                  <p>{item.text}</p>
                  <p className="text-xs text-neutral-500">{item.date}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}