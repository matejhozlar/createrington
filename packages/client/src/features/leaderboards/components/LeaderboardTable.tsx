import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router";
import { ChevronDown, Search } from "lucide-react";
import {
  formatStatCategory,
  formatStatItem,
  formatStatValue,
  statModName,
} from "@createrington/shared/minecraft-stats";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Paginator } from "@/components/paginator";
import {
  BOARD_SECTION_ID,
  figureSrc,
  formatGap,
  formatMetric,
  formatMetricCompact,
  heldFor,
  topRoleStyle,
  type TopRoleMetric,
} from "../top-roles";
import { useBoardParams, type Board } from "../hooks/use-board-params";
import { StatPicker, type Stat } from "./StatPicker";
import { RowDetails, type DetailTab } from "./RowDetails";

type BoardPage = RouterOutput["public"]["leaderboards"]["list"];
type BoardRow = BoardPage["rows"][number];
type BoardFocus = NonNullable<BoardPage["focus"]>;
type TopRole = RouterOutput["public"]["leaderboards"]["hero"][number];
type BoardEntry = (typeof BOARDS)[number];

const BOARDS: { board: Board; roleKey: string; metric: TopRoleMetric }[] = [
  { board: "playtime", roleKey: "the_sleepless", metric: "playtime" },
  { board: "records", roleKey: "the_unrivaled", metric: "records" },
  { board: "balance", roleKey: "capitalist", metric: "balance" },
];

function reveal(start: number): CSSProperties {
  const progress = `clamp(0, (var(--land, 1) - ${start}) / ${(1 - start).toFixed(2)}, 1)`;
  return {
    opacity: progress,
    transform: `translate3d(0, calc((1 - ${progress}) * 10px), 0)`,
  };
}

const REVEAL = {
  shadow: { opacity: "calc((var(--land, 1) - 0.6) * 2.5)" },
  title: reveal(0.55),
  name: reveal(0.7),
  value: reveal(0.82),
} satisfies Record<string, CSSProperties>;

function ChampionCard({
  entry,
  role,
  selected,
  now,
  onSelect,
}: {
  entry: BoardEntry;
  role: TopRole | undefined;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const style = topRoleStyle(entry.roleKey);
  const Icon = style.icon;
  const holder = role?.holder;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      data-dock-card
      style={{ "--tab": style.color } as CSSProperties}
      className={cn(
        "relative mt-12 flex min-w-0 flex-col items-center rounded-xl border bg-linear-to-br from-card to-card px-2 pb-3 text-center transition-colors @3xl:mt-14 @3xl:h-32 @3xl:flex-row @3xl:items-end @3xl:gap-4 @3xl:px-5 @3xl:text-left",
        selected
          ? "border-(--tab)/50 to-(--tab)/15"
          : "hover:border-primary/40",
      )}
    >
      <div className="relative -mt-12 flex shrink-0 items-end @3xl:mt-0">
        {holder ? (
          <>
            <div
              aria-hidden
              className="absolute bottom-0.5 left-1/2 h-2 w-16 -translate-x-1/2 rounded-[100%] bg-black/70 blur-sm @3xl:w-20"
              style={REVEAL.shadow}
            />
            <div className="relative" data-dock-to={entry.roleKey}>
              <img
                src={figureSrc(holder)}
                alt={holder.minecraftUsername}
                draggable={false}
                className="relative h-24 w-auto select-none @xl:h-28 @3xl:h-44"
              />
            </div>
          </>
        ) : (
          <Icon className="size-10 text-(--tab)/40" aria-hidden />
        )}
      </div>
      <span className="mt-2 flex w-full min-w-0 flex-col items-center @3xl:mt-0 @3xl:flex-1 @3xl:items-start @3xl:self-center @3xl:pt-2">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-(--tab) @3xl:text-xs"
          style={REVEAL.title}
        >
          <Icon className="size-3 @3xl:size-3.5" aria-hidden />
          {style.boardTitle}
        </span>
        <span
          className="mt-1 w-full truncate text-sm font-bold text-foreground @3xl:text-lg"
          style={REVEAL.name}
        >
          {holder?.minecraftUsername ?? "Nobody yet"}
        </span>
        <span
          className="w-full truncate text-sm font-bold tabular-nums text-(--tab) @xl:text-base @3xl:text-xl"
          title={holder ? formatMetric(entry.metric, holder.value) : undefined}
          style={REVEAL.value}
        >
          {holder
            ? formatMetricCompact(entry.metric, holder.value)
            : "Unclaimed"}
        </span>
        {holder && (
          <span
            className="hidden w-full truncate text-xs text-muted-foreground @3xl:block"
            style={REVEAL.value}
          >
            {heldFor(holder.heldSince, now)}
          </span>
        )}
      </span>
    </button>
  );
}

const PAGE_SIZE = 25;

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-amber-600",
};

function BoardRowItem({
  row,
  formatValue,
  share,
  isYou,
  note,
  expanded,
  onToggle,
  children,
}: {
  row: BoardRow;
  formatValue: (value: number) => string;
  share: number;
  isYou: boolean;
  note?: string | null;
  expanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
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
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {row.minecraftUsername}
          </span>
          {isYou && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </span>
        {note && (
          <span className="truncate text-xs text-muted-foreground">{note}</span>
        )}
      </span>
      <span className="relative shrink-0 text-sm font-semibold tabular-nums text-foreground/90">
        {formatValue(row.value)}
      </span>
      {onToggle && (
        <ChevronDown
          aria-hidden
          className={cn(
            "relative size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );
  const rowClass = cn(
    "relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.03]",
    row.rank === 1 && "bg-(--role)/10",
    isYou && "ring-1 ring-primary/40 bg-primary/5",
  );

  return (
    <li>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={rowClass}
        >
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
      {expanded && children && (
        <div className="px-3 pt-2 pb-3 sm:pl-14">{children}</div>
      )}
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

function gapNote(
  focus: BoardFocus,
  formatDifference: (value: number) => string,
): string | null {
  if (focus.ahead) {
    return `${formatDifference(focus.ahead.value - focus.row.value)} behind #${focus.ahead.rank}`;
  }
  if (focus.behind) {
    return `Leads #${focus.behind.rank} by ${formatDifference(focus.row.value - focus.behind.value)}`;
  }
  return null;
}

function statDescription(stat: Stat): string {
  const mod = statModName(stat.item);
  const item = formatStatItem(stat.category, stat.item).toLowerCase();
  const category = formatStatCategory(stat.category).toLowerCase();
  return `Every player ranked on ${item} (${category}${mod ? `, ${mod}` : ""}), totals across every season.`;
}

export function LeaderboardTable() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const params = useBoardParams();
  const { board } = params;
  const [roles] = trpc.public.leaderboards.hero.useSuspenseQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const [now] = useState(Date.now);
  const [detailTab, setDetailTab] = useState<DetailTab>("records");
  const [search, setSearch] = useState(params.search);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const active = BOARDS.find((b) => b.board === board) ?? BOARDS[0];
  const style = topRoleStyle(active.roleKey);
  const activeStat = params.stat;
  const view = activeStat
    ? `${board}:${activeStat.category}:${activeStat.item}`
    : board;
  const [paging, setPaging] = useState({
    view,
    page: 0,
    expanded: null as string | null,
  });
  const current =
    paging.view === view ? paging : { view, page: 0, expanded: null };
  const { page, expanded } = current;
  const setPage = (next: number) => setPaging({ ...current, page: next });
  const setExpanded = (next: (value: string | null) => string | null) =>
    setPaging({ ...current, expanded: next(current.expanded) });
  const statKey = {
    category: activeStat?.category ?? "",
    item: activeStat?.item ?? "",
  };
  const pageInput = {
    search: debouncedSearch || undefined,
    focus: user?.minecraftUuid ?? undefined,
    page,
    limit: PAGE_SIZE,
  };

  const boardQuery = trpc.public.leaderboards.list.useQuery(
    { board, ...pageInput },
    {
      staleTime: 60 * 1000,
      placeholderData: (previous) => previous,
      enabled: !activeStat,
    },
  );
  const statQuery = trpc.public.leaderboards.stat.useQuery(
    { ...statKey, ...pageInput },
    {
      staleTime: 60 * 1000,
      placeholderData: (previous) => previous,
      enabled: !!activeStat,
    },
  );
  const listQuery = activeStat ? statQuery : boardQuery;
  const rows = listQuery.data?.rows ?? [];
  const pagination = listQuery.data?.pagination;
  const topValue = listQuery.data?.topValue ?? 0;
  const contestedKeys = boardQuery.data?.contestedKeys ?? 0;
  const focus = listQuery.data?.focus ?? null;
  const focusNote = focus
    ? gapNote(focus, (value) =>
        activeStat
          ? formatStatValue(activeStat.category, activeStat.item, value)
          : formatGap(active.metric, value),
      )
    : null;
  const pinFocus =
    !!focus &&
    !rows.some((row) => row.minecraftUuid === focus.row.minecraftUuid);

  const formatValue = (value: number) =>
    activeStat
      ? formatStatValue(activeStat.category, activeStat.item, value)
      : formatMetric(active.metric, value);

  useEffect(() => {
    if (hash !== `#${BOARD_SECTION_ID}`) return;
    document
      .getElementById(BOARD_SECTION_ID)
      ?.scrollIntoView({ block: "start" });
  }, [hash]);

  const selectBoard = (next: Board) => params.update({ board: next });
  const selectStat = (next: Stat | null) => params.update({ stat: next });
  const toggleRow = (minecraftUuid: string) =>
    setExpanded((open) => (open === minecraftUuid ? null : minecraftUuid));

  return (
    <section
      id={BOARD_SECTION_ID}
      className="mx-auto max-w-5xl scroll-mt-14 px-5 py-12 md:scroll-mt-0 md:px-8 md:py-16"
      style={{ "--role": style.color } as CSSProperties}
    >
      <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Every player, ranked
      </h2>
      <p className="mt-1 text-sm text-muted-foreground md:text-base">
        {activeStat
          ? statDescription(activeStat)
          : active.board === "records" && contestedKeys > 0
            ? `Who holds the most #1 placements across ${contestedKeys.toLocaleString("en-US")} contested stats. Open a player to see which.`
            : style.boardDescription}
      </p>

      <div
        role="tablist"
        aria-label="Leaderboard"
        className="@container mt-6 grid grid-cols-3 gap-2 @xl:gap-4"
      >
        {BOARDS.map((entry) => (
          <ChampionCard
            key={entry.board}
            entry={entry}
            role={roles.find((role) => role.roleKey === entry.roleKey)}
            selected={entry.board === board}
            now={now}
            onSelect={() => selectBoard(entry.board)}
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl border bg-card p-3 md:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {board === "records" && (
            <StatPicker value={activeStat} onChange={selectStat} />
          )}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                params.update({ search: event.target.value.trim() });
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
                formatValue={formatValue}
                share={topValue > 0 ? row.value / topValue : 0}
                isYou={user?.minecraftUuid === row.minecraftUuid}
                note={
                  focus?.row.minecraftUuid === row.minecraftUuid
                    ? focusNote
                    : null
                }
                expanded={expanded === row.minecraftUuid}
                onToggle={() => toggleRow(row.minecraftUuid)}
              >
                <RowDetails
                  minecraftUuid={row.minecraftUuid}
                  minecraftUsername={row.minecraftUsername}
                  showRecords={board === "records" && !activeStat}
                  tab={detailTab}
                  onTabChange={setDetailTab}
                  onPick={selectStat}
                />
              </BoardRowItem>
            ))}
          </ol>
        )}

        {pinFocus && focus && (
          <ol className="sticky bottom-3 z-10 mt-2 rounded-lg bg-card shadow-[0_-12px_32px_rgba(0,0,0,0.55)]">
            <BoardRowItem
              row={focus.row}
              formatValue={formatValue}
              share={topValue > 0 ? focus.row.value / topValue : 0}
              isYou
              note={focusNote}
            />
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
