import { useState } from "react"
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

export function KnowbySearchDropdown({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[250px] justify-between hover:!bg-accent">
          <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
            {selected || "Select Knowby"}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[250px]">
        <Command>
          <CommandInput placeholder="Search Knowby..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Knowbys">
              {options.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => {
                    onChange(name)
                    setOpen(false)
                  }}
                >
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
