"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Define props for DatePickerWithRange
interface DatePickerWithRangeProps { // Changed: Removed extends React.HTMLAttributes<HTMLDivElement>
  className?: string; // Add className explicitly if it's used and needed from parent
  date: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  date,
  onSelect,
}: DatePickerWithRangeProps) { // Use the new interface for props
  // Remove the internal useState for date, as it will be controlled by the parent.
  // const [date, setDate] = React.useState<DateRange | undefined>({
  //   from: new Date(2022, 0, 20),
  //   to: addDays(new Date(2022, 0, 20), 20),
  // })

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
              "hover:!bg-accent dark:!bg-secondary dark:!text-secondary-foreground dark:hover:!bg-secondary/80 dark:border-transparent"
            )}
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from} // Use the date prop
            selected={date} // Use the date prop
            onSelect={onSelect} // Use the onSelect prop to communicate changes
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}