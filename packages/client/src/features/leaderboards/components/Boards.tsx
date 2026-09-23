import type { CSSProperties } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { formatMetric, topRoleStyle, type TopRoleMetric } from "../top-roles";

type Boards = RouterOutput["public"]["leaderboards"]["boards"];
type BoardEntry = Boards["playtime"][number];

const BOARDS: {
  roleKey: string;
  metric: TopRoleMetric;
  field: keyof Boards;
}[] = [
  { roleKey: "the_unrivaled", metric: "records", field: "records" },
  { roleKey: "the_sleepless", metric: "playtime", field: "playtime" },
  { roleKey: "capitalist", metric: "balance", field: "balance" },
];

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-amber-600",
};

function BoardRow({
  rank,
  entry,
  metric,
}: {
  rank: number;
  entry: BoardEntry;
  metric: TopRoleMetric;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        rank === 1 && "bg-(--role)/10",
      )}
    >
      <span
        className={cn(
          "w-6 shrink-0 text-right text-sm font-bold tabular-nums",
          RANK_STYLES[rank] ?? "text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <MinecraftAvatar
        username={entry.minecraftUsername}
        uuid={entry.minecraftUuid}
        size={28}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {entry.minecraftUsername}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
        {formatMetric(metric, entry.value)}
      </span>
    </li>
  );
}

function BoardSkeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-4 w-6 animate-pulse rounded bg-muted/40" />
          <div className="size-7 animate-pulse rounded-xs bg-muted/40" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
        </li>
      ))}
    </ul>
  );
}

export function Boards() {
  const boardsQuery = trpc.public.leaderboards.boards.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <div className="grid gap-6 md:grid-cols-3">
        {BOARDS.map(({ roleKey, metric, field }) => {
          const style = topRoleStyle(roleKey);
          const Icon = style.icon;
          const entries = boardsQuery.data?.[field];
          const rows = Array.isArray(entries) ? entries : [];

          return (
            <div
              key={roleKey}
              className="rounded-xl border bg-card p-4 md:p-5"
              style={{ "--role": style.color } as CSSProperties}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-(--role)/15 text-(--role)">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">
                    {style.boardTitle}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {style.boardDescription}
                  </p>
                </div>
              </div>

              {boardsQuery.isLoading ? (
                <BoardSkeleton />
              ) : rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nothing on the board yet.
                </p>
              ) : (
                <ol className="space-y-1">
                  {rows.map((entry, index) => (
                    <BoardRow
                      key={entry.minecraftUuid}
                      rank={index + 1}
                      entry={entry}
                      metric={metric}
                    />
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
