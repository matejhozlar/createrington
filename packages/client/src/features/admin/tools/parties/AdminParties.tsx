import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { UserMinus } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { queryClient, trpc, type RouterOutput } from "@/lib/trpc";
import { ClaimsDialog } from "./components/ClaimsDialog";
import { PartiesStatsCards } from "./components/PartiesStatsCards";
import {
  PartiesTable,
  type PartyRow,
  type PartySort,
  type PartySortKey,
} from "./components/PartiesTable";
import { useMutation, useQuery } from "@tanstack/react-query";

const SERVER_ID = 1;

const PAGE_COPY = {
  title: "Parties",
  description:
    "Every FTB Teams party on the server as core last reported it: members and their ranks, allies, claimed chunks and team tags.",
  search: "Search by party, tag or owner...",
  table: "Click a party to see its members and allies.",
  empty: "No party has been synced from the server yet.",
  noMatch: "No party matches the search.",
} as const;

const PURGE_COPY = {
  button: "Purge",
  title: "Purge departed members?",
  description:
    "Syncs the parties from the server first, then removes every member who has left the server from their party in game. Party owners are never removed.",
  confirm: "Purge",
} as const;

type PurgeResult = RouterOutput["admin"]["parties"]["purge"];

function purgeMessage({ removed, failed }: PurgeResult): string {
  const removedText =
    removed.length === 0
      ? "No departed members to remove."
      : `Removed ${removed.length} departed member${removed.length === 1 ? "" : "s"} from their parties.`;
  return failed === 0
    ? removedText
    : `${removedText} ${failed} could not be removed, see the server log.`;
}

const DEFAULT_SORT: PartySort = { key: "name", dir: "asc" };
const NO_PARTIES: PartyRow[] = [];

function compareParties(a: PartyRow, b: PartyRow, sort: PartySort): number {
  const direction = sort.dir === "asc" ? 1 : -1;
  switch (sort.key) {
    case "name":
      return direction * a.name.localeCompare(b.name);
    case "memberCount":
      return direction * (a.memberCount - b.memberCount);
    case "claimCount":
      if (a.claimCount === null || b.claimCount === null) {
        return (
          (a.claimCount === null ? 1 : 0) - (b.claimCount === null ? 1 : 0)
        );
      }
      return direction * (a.claimCount - b.claimCount);
    case "syncedAt":
      return (
        direction *
        (new Date(a.syncedAt).getTime() - new Date(b.syncedAt).getTime())
      );
  }
}

function matchesSearch(party: PartyRow, needle: string): boolean {
  return (
    party.name.toLowerCase().includes(needle) ||
    (party.tag?.toLowerCase().includes(needle) ?? false) ||
    (party.ownerName?.toLowerCase().includes(needle) ?? false)
  );
}

export function AdminParties() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PartySort>(DEFAULT_SORT);
  const [expandedId, setExpandedId] = useState<number | null>(
    () => Number(searchParams.get("party")) || null,
  );
  const [claimsDialog, setClaimsDialog] = useState<{
    partyId: number | null;
  } | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const needle = useDebouncedValue(search).trim().toLowerCase();

  const purgeMutation = useMutation(
    trpc.admin.parties.purge.mutationOptions(
      useMutationToast({
        success: purgeMessage,
        onSuccess: () =>
          queryClient.invalidateQueries(trpc.admin.parties.pathFilter()),
      }),
    ),
  );

  const statsQuery = useQuery(
    trpc.admin.parties.stats.queryOptions({ serverId: SERVER_ID }),
  );
  const listQuery = useQuery(
    trpc.admin.parties.list.queryOptions({ serverId: SERVER_ID }),
  );
  const parties = listQuery.data ?? NO_PARTIES;

  const shown = useMemo(
    () =>
      parties
        .filter((party) => !needle || matchesSearch(party, needle))
        .sort((a, b) => compareParties(a, b, sort)),
    [parties, needle, sort],
  );

  const toggleSort = (key: PartySortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const lastSyncedAt = statsQuery.data?.lastSyncedAt ?? null;
  const claimsSyncedAt = statsQuery.data?.claimsSyncedAt ?? null;

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
          actions={
            <Button variant="outline" onClick={() => setPurgeOpen(true)}>
              <UserMinus className="mr-2 size-4" />
              {PURGE_COPY.button}
            </Button>
          }
          description={
            <>
              <p>{PAGE_COPY.description}</p>
              {lastSyncedAt && (
                <p className="text-xs">
                  Last synced {formatRelativeDateSafe(lastSyncedAt)}
                  {claimsSyncedAt &&
                    ` · Claims synced ${formatRelativeDateSafe(claimsSyncedAt)}`}
                </p>
              )}
            </>
          }
        />

        {statsQuery.isLoading ? (
          <LoadingState
            text="Loading party totals..."
            className="flex-none p-0"
          />
        ) : statsQuery.data ? (
          <PartiesStatsCards
            stats={statsQuery.data}
            onBrowseClaims={() => setClaimsDialog({ partyId: null })}
          />
        ) : null}

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder={PAGE_COPY.search}
          activeCount={search ? 1 : 0}
        />

        <Card>
          <CardHeader>
            <CardTitle>
              {PAGE_COPY.title}
              {!listQuery.isLoading && ` (${shown.length})`}
            </CardTitle>
            <CardDescription>{PAGE_COPY.table}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {listQuery.isError ? (
              <p className="py-8 text-center text-destructive">
                Failed to load the parties: {listQuery.error.message}
              </p>
            ) : !listQuery.isLoading && parties.length === 0 ? (
              <p className="px-6 py-8 text-center text-muted-foreground">
                {PAGE_COPY.empty}
              </p>
            ) : !listQuery.isLoading && shown.length === 0 ? (
              <p className="px-6 py-8 text-center text-muted-foreground">
                {PAGE_COPY.noMatch}
              </p>
            ) : (
              <PartiesTable
                parties={shown}
                loading={listQuery.isLoading}
                sort={sort}
                onSort={toggleSort}
                expandedId={expandedId}
                onToggle={(id) =>
                  setExpandedId((prev) => (prev === id ? null : id))
                }
                onShowClaims={(partyId) => setClaimsDialog({ partyId })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ClaimsDialog
        open={claimsDialog !== null}
        onOpenChange={(open) => {
          if (!open) setClaimsDialog(null);
        }}
        serverId={SERVER_ID}
        initialPartyId={claimsDialog?.partyId ?? null}
      />

      <ConfirmDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        title={PURGE_COPY.title}
        description={PURGE_COPY.description}
        confirmLabel={PURGE_COPY.confirm}
        variant="destructive"
        onConfirm={() => purgeMutation.mutateAsync({ serverId: SERVER_ID })}
      />
    </div>
  );
}
