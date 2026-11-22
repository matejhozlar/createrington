import { useState } from "react";
import { History, TriangleAlert, Vote } from "lucide-react";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import { CardDescription, CardTitle } from "@/components/ui/card";
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
import { usePagedQuery } from "@/hooks/use-paged-query";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Status = "all" | "paid" | "pending" | "unlinked";
type VoteRow = RouterOutput["admin"]["votes"]["list"]["items"][number];

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
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "violet" },
  unlinked: { label: "Unregistered", tone: "neutral" },
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
        <Badge tone={badge.tone}>
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
  const needle = useDebouncedValue(search).trim();

  const votes = usePagedQuery(
    { search: needle || undefined, status },
    (input) => trpc.admin.votes.list.queryOptions(input),
    PAGE_SIZE,
  );

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder={COPY.search}
        activeCount={(search ? 1 : 0) + (status !== "all" ? 1 : 0)}
      >
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
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

      <TableCard
        header={
          <>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" />
              {COPY.title}
              {votes.query.data && ` (${votes.total.toLocaleString()})`}
            </CardTitle>
            <CardDescription>{COPY.description}</CardDescription>
          </>
        }
        paged={{
          ...votes,
          error: votes.error && `Failed to load the votes: ${votes.error}`,
        }}
        compact
        empty={{ icon: Vote, message: COPY.empty, className: "py-8" }}
        itemLabel="vote"
        columns={COLUMNS}
        rowKey={(vote) => String(vote.id)}
      />
    </>
  );
}
