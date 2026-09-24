import { useState } from "react";
import {
  formatStatCategory,
  formatStatItem,
  formatStatValue,
  statModName,
} from "@createrington/shared/minecraft-stats";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { Stat } from "./StatPicker";

const PREVIEW_COUNT = 12;

function leadLabel(
  category: string,
  item: string,
  value: number,
  runnerUp: number,
) {
  const lead = value - runnerUp;
  return lead > 0 ? `+${formatStatValue(category, item, lead)} ahead` : "Tied";
}

export function HeldRecords({
  minecraftUuid,
  onPick,
}: {
  minecraftUuid: string;
  onPick: (stat: Stat) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const recordsQuery = trpc.public.leaderboards.recordsHeld.useQuery(
    { minecraftUuid },
    { staleTime: 60 * 1000 },
  );

  if (recordsQuery.isLoading) {
    return (
      <div className="grid gap-1.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[3.25rem] animate-pulse rounded-md bg-muted/30"
          />
        ))}
      </div>
    );
  }

  const records = recordsQuery.data ?? [];
  if (records.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No contested records right now.
      </p>
    );
  }

  const visible = showAll ? records : records.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {visible.map((record) => {
          const mod = statModName(record.item);
          return (
            <li key={`${record.category}|${record.item}`}>
              <button
                type="button"
                onClick={() =>
                  onPick({ category: record.category, item: record.item })
                }
                className="flex w-full items-center gap-3 rounded-md border bg-background/40 px-3 py-2 text-left transition-colors hover:border-primary/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {formatStatItem(record.category, record.item)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatStatCategory(record.category)}
                    {mod && ` · ${mod}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">
                    {formatStatValue(
                      record.category,
                      record.item,
                      record.value,
                    )}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {leadLabel(
                      record.category,
                      record.item,
                      record.value,
                      record.runnerUp,
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {records.length > PREVIEW_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((current) => !current)}
          className="mt-2"
        >
          {showAll ? "Show fewer" : `Show all ${records.length} records`}
        </Button>
      )}
    </div>
  );
}
