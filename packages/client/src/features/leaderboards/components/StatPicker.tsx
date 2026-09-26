import { useState } from "react";
import { ChartNoAxesColumn, ChevronDown, X } from "lucide-react";
import {
  formatStatCategory,
  formatStatItem,
  statModName,
} from "@createrington/shared/minecraft-stats";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { Spinner } from "@/components/ui/spinner";

export interface Stat {
  category: string;
  item: string;
}

function statKey({ category, item }: Stat): string {
  return `${category}|${item}`;
}

function statLabel({ category, item }: Stat): string {
  return `${formatStatItem(category, item)} · ${formatStatCategory(category)}`;
}

function StatResults({ onPick }: { onPick: (stat: Stat) => void }) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 200);
  const searching = debounced.length >= 2;

  const searchQuery = trpc.public.leaderboards.searchStats.useQuery(
    { query: debounced },
    {
      enabled: searching,
      staleTime: 60 * 1000,
      placeholderData: (previous) => previous,
    },
  );
  const results = searching ? (searchQuery.data ?? []) : [];

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Diamond ore, jumps, zombie…"
      />
      <CommandList>
        {!searching ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Search any stat to rank every player on it.
          </p>
        ) : searchQuery.isFetching && results.length === 0 ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-4 text-muted-foreground" />
          </div>
        ) : (
          <CommandEmpty>No stat matching "{debounced}".</CommandEmpty>
        )}
        {results.map((stat) => {
          const mod = statModName(stat.item);
          return (
            <CommandItem
              key={statKey(stat)}
              value={statKey(stat)}
              onSelect={() => onPick(stat)}
              className="gap-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {formatStatItem(stat.category, stat.item)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatStatCategory(stat.category)}
                  {mod && ` · ${mod}`}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {stat.holders.toLocaleString("en-US")}{" "}
                {stat.holders === 1 ? "player" : "players"}
              </span>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}

export function StatPicker({
  value,
  onChange,
}: {
  value: Stat | null;
  onChange: (stat: Stat | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "group flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
              value && "border-(--role)/50 text-(--role)",
            )}
          >
            <ChartNoAxesColumn className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {value ? statLabel(value) : "All records"}
            </span>
            <ChevronDown
              className="size-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(24rem,calc(100vw-2rem))] p-0"
        >
          <StatResults
            onPick={(stat) => {
              onChange(stat);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Back to all records"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
