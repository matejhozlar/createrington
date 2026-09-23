import { useState, type CSSProperties } from "react";
import { Search } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Paginator } from "@/components/paginator";
import { formatMetric, topRoleStyle, type TopRoleMetric } from "../top-roles";

type Board = "records" | "playtime" | "balance";
type BoardRow = RouterOutput["public"]["leaderboards"]["list"]["rows"][number];

const BOARDS: { board: Board; roleKey: string; metric: TopRoleMetric }[] = [
  { board: "records", roleKey: "the_unrivaled", metric: "records" },
  { board: "playtime", roleKey: "the_sleepless", metric: "playtime" },
  { board: "balance", roleKey: "capitalist", metric: "balance" },
];

const PAGE_SIZE = 25;

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-amber-600",
};

function BoardRowItem({
  row,
  metric,
  share,
  isYou,
}: {
  row: BoardRow;
  metric: TopRoleMetric;
  share: number;
  isYou: boolean;
}) {
  return (
    <li
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]",
        row.rank === 1 && "bg-(--role)/10",
        isYou && "ring-1 ring-primary/40 bg-primary/5",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 bg-(--role)/[0.07]"
        style={{ width: `${Math.max(2, share * 100).toFixed(1)}%` }}
      />
      <span
        className={cn(
          "relative w-8 shrink-0 text-right text-sm font-bold tabular-nums",
          RANK_STYLES[row.rank] ?? "text-muted-foreground",
        )}
      >
        {row.rank}
      </span>
      <MinecraftAvatar
        username={row.minecraftUsername}
        uuid={row.minecraftUuid}
        size={28}
        className="relative"
      />
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">
          {row.minecraftUsername}
        </span>
        {isYou && (
          <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            You
          </span>
        )}
      </span>
      <span className="relative shrink-0 text-sm font-semibold tabular-nums text-foreground/90">
        {formatMetric(metric, row.value)}
      </span>
    </li>
  );
}

function RowsSkeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-4 w-8 animate-pulse rounded bg-muted/40" />
          <div className="size-7 animate-pulse rounded-xs bg-muted/40" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted/40" />
        </li>
      ))}
    </ul>
  );
}

export function LeaderboardTable() {
  const { user } = useAuth();
  const [board, setBoard] = useState<Board>("records");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const active = BOARDS.find((b) => b.board === board) ?? BOARDS[0];
  const style = topRoleStyle(active.roleKey);
  const Icon = style.icon;

  const listQuery = trpc.public.leaderboards.list.useQuery(
    {
      board,
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { staleTime: 60 * 1000, placeholderData: (previous) => previous },
  );
  const topQuery = trpc.public.leaderboards.list.useQuery(
    { board, page: 0, limit: 1 },
    { staleTime: 60 * 1000 },
  );

  const rows = listQuery.data?.rows ?? [];
  const pagination = listQuery.data?.pagination;
  const topValue = topQuery.data?.rows[0]?.value ?? 0;
  const contestedKeys = listQuery.data?.contestedKeys ?? 0;

  const selectBoard = (next: Board) => {
    setBoard(next);
    setPage(0);
  };

  return (
    <section
      className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16"
      style={{ "--role": style.color } as CSSProperties}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Every player, ranked
          </h2>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            {active.board === "records" && contestedKeys > 0
              ? `Who holds the most #1 placements across ${contestedKeys.toLocaleString("en-US")} contested stats.`
              : style.boardDescription}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Leaderboard"
          className="inline-flex shrink-0 rounded-lg border bg-card p-1"
        >
          {BOARDS.map((entry) => {
            const entryStyle = topRoleStyle(entry.roleKey);
            const EntryIcon = entryStyle.icon;
            const selected = entry.board === board;
            return (
              <button
                key={entry.board}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectBoard(entry.board)}
                style={{ "--tab": entryStyle.color } as CSSProperties}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-(--tab)/15 text-(--tab)"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <EntryIcon className="size-4" aria-hidden />
                {entryStyle.boardTitle}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-3 md:p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--role)/15 text-(--role)">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search players"
              aria-label="Search players"
              className="pl-9"
            />
          </div>
        </div>

        {listQuery.isLoading ? (
          <RowsSkeleton />
        ) : rows.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? `No player matching "${debouncedSearch}".`
              : "Nothing on the board yet."}
          </p>
        ) : (
          <ol
            className={cn(
              "space-y-1 transition-opacity",
              listQuery.isPlaceholderData && "opacity-60",
            )}
          >
            {rows.map((row) => (
              <BoardRowItem
                key={row.minecraftUuid}
                row={row}
                metric={active.metric}
                share={topValue > 0 ? row.value / topValue : 0}
                isYou={user?.minecraftUuid === row.minecraftUuid}
              />
            ))}
          </ol>
        )}

        {pagination && pagination.total > 0 && (
          <Paginator
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            itemLabel="player"
            className="mt-3"
          />
        )}
      </div>
    </section>
  );
}
