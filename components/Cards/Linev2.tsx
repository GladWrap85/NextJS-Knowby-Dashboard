'use client'

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { ResponsiveLine } from "@nivo/line";
import { KnowbySearchDropdown } from "../KnowbySearchDropdown";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface Props {
  options: string[]
  selected: string | null
  onChange: (val: string) => void
}

function parseDate(dateStr: string) {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day).toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function CardWithLineSwitcher() {
  const [dataType, setDataType] = useState<"views" | "completions">("views");
  const [data, setData] = useState<any[]>([]);
  const [knowbyOptions, setKnowbyOptions] = useState<string[]>([]);
  const [selectedKnowby, setSelectedKnowby] = useState<string | null>(null);

  useEffect(() => {
    const filePath = dataType === "views" ? "/views.csv" : "/completions.csv";

    Papa.parse(filePath, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const raw = results.data as any[];

        const grouped: Record<string, Record<string, number>> = {};

        raw.forEach((d) => {
          if (!d.date || !d.knowby_name) return;

          const date = parseDate(d.date);
          const name = d.knowby_name;

          if (!grouped[name]) grouped[name] = {};
          if (!grouped[name][date]) grouped[name][date] = 0;

          grouped[name][date]++;
        });

        const knowbys = Object.keys(grouped);
        setKnowbyOptions(knowbys);

        const formatted = knowbys.map((name) => ({
          id: name,
          data: Object.entries(grouped[name])
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([x, y]) => ({ x, y })),
        }));

        setData(formatted);

        if (!selectedKnowby && knowbys.length > 0) {
          setSelectedKnowby(knowbys[0]);
        }
      },
    });
  }, [dataType]);

  const filtered = data.find((d) => d.id === selectedKnowby);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <CardTitle>This week</CardTitle>
          <CardDescription>These are the results of this week.</CardDescription>
        </div>
        <CardContent>
        </CardContent>
        <div className="flex gap-4">
          <KnowbySearchDropdown
            options={knowbyOptions}
            selected={selectedKnowby}
            onChange={(val: string) => setSelectedKnowby(val)}
          />
          <Select
            value={dataType}
            onValueChange={(val: "views" | "completions") => setDataType(val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="views">Views</SelectItem>
              <SelectItem value="completions">Completions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="h-[400px]">
        

        {filtered && (
          <ResponsiveLine
            data={[filtered]}
            margin={{ top: 30, right: 40, bottom: 50, left: 60 }}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: "Date",
              legendOffset: 36,
              legendPosition: "middle",
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              legend: dataType === "views" ? "Views" : "Completions",
              legendOffset: -50,
              legendPosition: "middle",
            }}
            pointSize={6}
            pointColor={{ theme: "background" }}
            pointBorderWidth={2}
            useMesh={true}
          />
        )}
      </CardContent>
    </Card>
  );
}
