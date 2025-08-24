'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BellIcon } from "lucide-react";
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

  return (
    <div className="grid grid-cols-2 gap-4 p-3 border-b">
      <div className="flex items-center">
        <Button className="relative hover:!bg-accent dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent" onClick={toggle} variant={"outline"} size="icon">
          {expanded ? <ChevronFirst /> : <ChevronLast />}
        </Button>
        <span className="text-2xl font-bold pl-4">Dashboard</span>
      </div>
      <div className="flex items-center justify-end gap-[32px] pr-4">
        <DropdownMenu>
          {/* Pass the dateRange and setDateRange from context to DatePickerWithRange */}
          <DatePickerWithRange
            date={dateRange}
            onSelect={setDateRange}
          />
          <DropdownMenuTrigger asChild>
            <Button className="relative hover:!bg-accent  dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent" variant="outline" size="icon">
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