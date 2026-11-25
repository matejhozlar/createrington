import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SUPPORTED_ZONES = Intl.supportedValuesOf("timeZone");
const TIME_ZONES = SUPPORTED_ZONES.includes("UTC")
  ? SUPPORTED_ZONES
  : ["UTC", ...SUPPORTED_ZONES];

export function TimezonePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const zones = TIME_ZONES.includes(value)
    ? TIME_ZONES
    : [value, ...TIME_ZONES];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className="group flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <span className="truncate">{value}</span>
          <ChevronDown
            className="size-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Europe/Prague, America/New_York…" />
          <CommandList>
            <CommandEmpty>No matching timezone.</CommandEmpty>
            {zones.map((zone) => (
              <CommandItem
                key={zone}
                value={zone}
                onSelect={() => {
                  onChange(zone);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate">{zone}</span>
                <Check
                  className={cn(
                    "size-4",
                    zone === value ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
