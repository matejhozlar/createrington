import { useState } from "react";
import { Trophy } from "lucide-react";
import { CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PlayerLabel } from "@/components/player-label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Window = "all" | "30d";
type TopVoter = RouterOutput["admin"]["votes"]["topVoters"][number];

const WINDOWS: { value: Window; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
];

const COPY = {
  title: "Top voters",
  description: "Registered players with the most votes.",
  empty: "No registered player has voted in this window.",
} as const;

const COLUMNS: DataTableColumn<TopVoter>[] = [
  {
    key: "rank",
    header: "#",
    width: 56,
    render: (_voter, index) => (
      <span className="tabular-nums text-muted-foreground">{index + 1}</span>
    ),
  },
  {
    key: "player",
    header: "Player",
    minWidth: 160,
    render: (voter) => (
      <PlayerLabel
        uuid={voter.playerMinecraftUuid}
        name={voter.minecraftUsername}
      />
    ),
  },
  {
    key: "votes",
    header: "Votes",
    width: 80,
    align: "right",
    render: (voter) => (
      <span className="font-medium tabular-nums">{voter.votes}</span>
    ),
  },
  {
    key: "last",
    header: "Last vote",
    width: 130,
    render: (voter) => (
      <CellText
        value={new Date(voter.lastVotedAt).toLocaleString()}
        display={formatRelativeDateSafe(voter.lastVotedAt)}
        className="text-sm text-muted-foreground"
      />
    ),
  },
];

export function TopVotersCard() {
  const [window, setWindow] = useState<Window>("all");
  const query = trpc.admin.votes.topVoters.useQuery({ window, limit: 10 });
  const voters = query.data ?? [];

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-muted-foreground" />
          {COPY.title}
        </CardTitle>
        <CardDescription>{COPY.description}</CardDescription>
        <Tabs
          value={window}
          onValueChange={(value) => setWindow(value as Window)}
          className="mt-2"
        >
          <TabsList>
            {WINDOWS.map((entry) => (
              <TabsTrigger
                key={entry.value}
                value={entry.value}
                className="cursor-pointer"
              >
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-0">
        {query.isError ? (
          <p className="py-8 text-center text-destructive">
            Failed to load the top voters: {query.error.message}
          </p>
        ) : !query.isLoading && voters.length === 0 ? (
          <p className="px-6 py-8 text-center text-muted-foreground">
            {COPY.empty}
          </p>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={voters}
            loading={query.isLoading}
            loadingRows={10}
            rowKey={(voter) => voter.playerMinecraftUuid}
          />
        )}
      </CardContent>
    </Card>
  );
}
