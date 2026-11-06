import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History, TriangleAlert } from "lucide-react";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Status = "all" | "paid" | "pending" | "unlinked";
type VoteRow = RouterOutput["admin"]["votes"]["list"]["votes"][number];

const PAGE_SIZE = 25;

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All votes" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "unlinked", label: "Unregistered" },
];

const COPY = {
  title: "Vote history",
  description:
    "Every vote the server received, newest first. Votes from names that are not registered yet are kept and linked when the player registers.",
  search: "Search by Minecraft name...",
  empty: "No vote matches the filters.",
} as const;

const STATUS_BADGES = {
  paid: { label: "Paid", className: "bg-green-500/20 text-green-500" },
  pending: { label: "Pending", className: "bg-chart-4/20 text-chart-4" },
  unlinked: {
    label: "Unregistered",
    className: "bg-muted text-muted-foreground",
  },
} as const;

function statusOf(vote: VoteRow): keyof typeof STATUS_BADGES {
  if (vote.rewardedAt) return "paid";
  return vote.playerMinecraftUuid ? "pending" : "unlinked";
}

const COLUMNS: DataTableColumn<VoteRow>[] = [
  {
    key: "player",
    header: "Player",
    minWidth: 180,
    render: (vote) =>
      vote.playerMinecraftUuid ? (
        <PlayerLabel uuid={vote.playerMinecraftUuid} name={vote.username} />
      ) : (
        <PlayerLabel name={vote.username} linkable={false} />
      ),
  },
  {
    key: "site",
    header: "Site",
    minWidth: 160,
    render: (vote) => <CellText value={vote.serviceName} className="text-sm" />,
  },
  {
    key: "voted",
    header: "Voted",
    width: 190,
    render: (vote) => (
      <CellText
        value={new Date(vote.votedAt).toLocaleString()}
        className="text-sm tabular-nums"
      />
    ),
  },
  {
    key: "status",
    header: "Reward",
    width: 140,
    skeleton: () => <BadgeCellSkeleton />,
    render: (vote) => {
      const badge = STATUS_BADGES[statusOf(vote)];
      const element = (
        <Badge className={badge.className}>
          <span className="truncate">{badge.label}</span>
        </Badge>
      );
      if (!vote.rewardError) return element;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5">
              {element}
              <TriangleAlert
                className="size-3.5 text-destructive"
                aria-label="Reward error"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-words">
            {vote.rewardError}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
];

export function VotesListCard() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(0);
  const needle = useDebouncedValue(search, 300).trim();

  const query = useQuery(
    trpc.admin.votes.list.queryOptions(
      {
        search: needle || undefined,
        status,
        page,
        limit: PAGE_SIZE,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const votes = query.data?.votes ?? [];
  const total = query.data?.pagination.total ?? 0;
  const totalPages = query.data?.pagination.totalPages ?? 0;
  const loading = query.isLoading || query.isPlaceholderData;

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder={COPY.search}
        activeCount={(search ? 1 : 0) + (status !== "all" ? 1 : 0)}
      >
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as Status);
            setPage(0);
          }}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" />
            {COPY.title}
            {query.data && ` (${total.toLocaleString()})`}
          </CardTitle>
          <CardDescription>{COPY.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {query.isError ? (
            <p className="py-8 text-center text-destructive">
              Failed to load the votes: {query.error.message}
            </p>
          ) : !loading && votes.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              {COPY.empty}
            </p>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={votes}
              loading={loading}
              loadingRows={loadingRowCount(page, PAGE_SIZE, total)}
              rowKey={(vote) => String(vote.id)}
            />
          )}
        </CardContent>
        {total > 0 && (
          <CardFooter className="border-t">
            <Paginator
              page={page}
              limit={PAGE_SIZE}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
              itemLabel="vote"
              className="w-full"
            />
          </CardFooter>
        )}
      </Card>
    </>
  );
}
