"use client"; // This context will be used in client components

import { createContext, useContext, useState, ReactNode } from "react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns"; // To help with initial date

interface DateRangeContextType {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
}

// Create the context with a default undefined value.
// It will be provided by DateRangeProvider.
export const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

interface DateRangeProviderProps {
  children: ReactNode;
}

export function DateRangeProvider({ children }: DateRangeProviderProps) {
  // Initialize the date range state.
  // Example: Default to the last 7 days from today.
  const initialDateRange: DateRange = {
    from: addDays(new Date(), -6), // 6 days before today
    to: new Date(), // Today
  };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

// Custom hook to easily consume the context
export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}