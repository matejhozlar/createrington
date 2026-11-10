import { LoadingState } from "@/components/query-states";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { trpc } from "@/lib/trpc";
import { RewardCommandsCard } from "./components/RewardCommandsCard";
import { TopVotersCard } from "./components/TopVotersCard";
import { VoteStatsCards } from "./components/VoteStatsCards";
import { VotesListCard } from "./components/VotesListCard";
import { useQuery } from "@tanstack/react-query";

const PAGE_COPY = {
  title: "Votes",
  description:
    "Server-list votes received by the app. Each vote is announced in the server chat when it arrives and paid in game the next time the voter is online.",
} as const;

export function AdminVotes() {
  const statsQuery = useQuery(trpc.admin.votes.stats.queryOptions());
  const lastVotedAt = statsQuery.data?.lastVotedAt ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: PAGE_COPY.title },
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title={PAGE_COPY.title}
          description={
            <>
              <p>{PAGE_COPY.description}</p>
              {lastVotedAt && (
                <p className="text-xs">
                  Last vote {formatRelativeDateSafe(lastVotedAt)}
                </p>
              )}
            </>
          }
        />

        {statsQuery.isLoading ? (
          <LoadingState
            text="Loading vote totals..."
            className="flex-none p-0"
          />
        ) : statsQuery.isError ? (
          <p className="text-sm text-destructive">
            Failed to load the vote totals: {statsQuery.error.message}
          </p>
        ) : statsQuery.data ? (
          <VoteStatsCards stats={statsQuery.data} />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <TopVotersCard />
          <RewardCommandsCard />
        </div>

        <VotesListCard />
      </div>
    </div>
  );
}
