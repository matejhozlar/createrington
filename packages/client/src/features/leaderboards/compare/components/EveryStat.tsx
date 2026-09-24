import { useState } from "react";
import { Search } from "lucide-react";
import {
  formatStatCategory,
  formatStatItem,
  formatStatValue,
  statModName,
} from "@createrington/shared/minecraft-stats";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TugRow } from "./TugRow";

type Sort = "gap" | "total";

const SORTS: { value: Sort; label: string }[] = [
  { value: "gap", label: "Biggest gap" },
  { value: "total", label: "Most total" },
];

const PAGE_STEP = 10;
const MAX_ROWS = 50;

function isSort(value: string): value is Sort {
  return SORTS.some((sort) => sort.value === value);
}

function RowsSkeleton() {
  return (
    <div className="space-y-4 py-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded bg-muted/30" />
      ))}
    </div>
  );
}

export function EveryStat({
  first,
  second,
}: {
  first: string;
  second: string;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("gap");
  const [shown, setShown] = useState({ key: "", limit: PAGE_STEP });
  const debounced = useDebouncedValue(search.trim(), 250);
  const viewKey = `${first}|${second}|${debounced}|${sort}`;
  const limit = shown.key === viewKey ? shown.limit : PAGE_STEP;

  const statsQuery = trpc.public.leaderboards.headToHead.useQuery(
    { first, second, search: debounced || undefined, sort, limit },
    { staleTime: 60 * 1000, placeholderData: (previous) => previous },
  );
  const rows = statsQuery.data?.rows ?? [];
  const total = statsQuery.data?.pagination.total ?? 0;
  const canShowMore = rows.length < total && limit < MAX_ROWS;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-bold md:text-[22px]">Every stat</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search stats, e.g. diamond"
              aria-label="Search stats"
              className="pl-9"
            />
          </div>
          <Tabs
            value={sort}
            onValueChange={(value) => isSort(value) && setSort(value)}
          >
            <TabsList className="grid w-full grid-cols-2 sm:w-fit">
              {SORTS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="rounded-xl border bg-card px-4 py-1 md:px-5">
        {statsQuery.isLoading ? (
          <RowsSkeleton />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {debounced
              ? `Neither player has a stat matching "${debounced}".`
              : "Neither player has any stats yet."}
          </p>
        ) : (
          <div
            className={cn(
              "transition-opacity",
              statsQuery.isPlaceholderData && "opacity-60",
            )}
          >
            {rows.map((row) => {
              const mod = statModName(row.item);
              return (
                <TugRow
                  key={`${row.category}|${row.item}`}
                  size="sm"
                  label={
                    <>
                      {formatStatItem(row.category, row.item)}
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatStatCategory(row.category)}
                        {mod && ` · ${mod}`}
                      </span>
                    </>
                  }
                  left={{
                    value: row.first,
                    text: formatStatValue(row.category, row.item, row.first),
                  }}
                  right={{
                    value: row.second,
                    text: formatStatValue(row.category, row.item, row.second),
                  }}
                />
              );
            })}
          </div>
        )}
        {canShowMore && (
          <div className="flex justify-center pt-1 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setShown({
                  key: viewKey,
                  limit: Math.min(MAX_ROWS, limit + PAGE_STEP),
                })
              }
            >
              Show more
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
