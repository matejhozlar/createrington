import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToastActions } from "@/hooks/use-toast";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { ChunkPartiesTable } from "./components/ChunkPartiesTable";
import { ChunkSoloPlayersSection } from "./components/ChunkSoloPlayersSection";
import { FakePartyCard } from "./components/FakePartyCard";
import { PartiesEmptyState } from "./components/PartiesEmptyState";
import { PartiesFiltersBar } from "./components/PartiesFiltersBar";
import { PartiesKpiCards } from "./components/PartiesKpiCards";
import { QualifiedPlayersSection } from "./components/QualifiedPlayersSection";
import type { PartyFilters } from "./types";

// TODO: restore server selector when multi-server support returns
const SERVER_ID = 1;
const POST_RESYNC_REFETCH_MS = 2000;

const DEFAULT_FILTERS: PartyFilters = {
  search: "",
  dimension: "all",
  alliedOnly: false,
  activeForceloadsOnly: false,
  optedInOnly: false,
};

export function AdminParties() {
  const toast = useToastActions();
  const [filters, setFilters] = useState<PartyFilters>(DEFAULT_FILTERS);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const kpisQuery = trpc.admin.parties.kpis.useQuery({ serverId: SERVER_ID });
  const chunkKpisQuery = trpc.admin.parties.chunkKpis.useQuery({
    serverId: SERVER_ID,
  });
  const chunkPartiesQuery = trpc.admin.parties.chunkParties.useQuery({
    serverId: SERVER_ID,
  });
  const chunkSoloPlayersQuery = trpc.admin.parties.chunkSoloPlayers.useQuery({
    serverId: SERVER_ID,
  });
  const qualifiedQuery = trpc.admin.parties.qualifiedPlayers.useQuery({
    serverId: SERVER_ID,
  });
  const fakePartyQuery = trpc.admin.parties.fakeParty.useQuery({
    serverId: SERVER_ID,
  });
  const resyncMutation = trpc.admin.parties.resync.useMutation();

  const isRefreshing =
    kpisQuery.isFetching ||
    chunkKpisQuery.isFetching ||
    chunkPartiesQuery.isFetching ||
    chunkSoloPlayersQuery.isFetching ||
    qualifiedQuery.isFetching ||
    fakePartyQuery.isFetching ||
    resyncMutation.isPending;

  const refetchAll = () => {
    kpisQuery.refetch();
    chunkKpisQuery.refetch();
    chunkPartiesQuery.refetch();
    chunkSoloPlayersQuery.refetch();
    qualifiedQuery.refetch();
    fakePartyQuery.refetch();
    setLastRefreshedAt(new Date());
  };

  const handleResync = async () => {
    try {
      await resyncMutation.mutateAsync({ serverId: SERVER_ID });
      toast.success("Sync dispatched — new data inbound...", "Resync");
      setTimeout(refetchAll, POST_RESYNC_REFETCH_MS);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unknown error",
        "Resync failed",
      );
      refetchAll();
    }
  };

  const loaded =
    !kpisQuery.isLoading &&
    !chunkKpisQuery.isLoading &&
    !chunkPartiesQuery.isLoading &&
    !chunkSoloPlayersQuery.isLoading &&
    !qualifiedQuery.isLoading &&
    !fakePartyQuery.isLoading;

  const hasAnyData =
    (chunkPartiesQuery.data?.length ?? 0) > 0 ||
    (chunkSoloPlayersQuery.data?.length ?? 0) > 0 ||
    (qualifiedQuery.data?.length ?? 0) > 0 ||
    !!fakePartyQuery.data;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Parties</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleResync}
              disabled={isRefreshing}
              aria-label="Resync party data"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Dispatch /opac-fp sync and reload data
          </TooltipContent>
        </Tooltip>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Parties</h1>
            <p className="text-sm text-muted-foreground">
              Claimed chunks, forceload status, ally status, and members for
              every party on the server.
            </p>
            {lastRefreshedAt && (
              <p className="text-xs text-muted-foreground">
                Last refreshed {formatRelativeDateSafe(lastRefreshedAt)}
              </p>
            )}
          </div>
        </div>

        {kpisQuery.isLoading || chunkKpisQuery.isLoading ? (
          <Loading size="medium" text="Loading KPIs..." />
        ) : kpisQuery.data && chunkKpisQuery.data ? (
          <PartiesKpiCards
            kpis={kpisQuery.data}
            chunkKpis={chunkKpisQuery.data}
          />
        ) : null}

        {!loaded ? (
          <Loading size="medium" text="Loading party data..." />
        ) : !hasAnyData ? (
          <PartiesEmptyState
            onResync={handleResync}
            isResyncing={isRefreshing}
          />
        ) : (
          <>
            <PartiesFiltersBar filters={filters} onChange={setFilters} />

            {chunkPartiesQuery.data && (
              <ChunkPartiesTable
                serverId={SERVER_ID}
                parties={chunkPartiesQuery.data}
                filters={filters}
              />
            )}

            {chunkSoloPlayersQuery.data &&
              chunkSoloPlayersQuery.data.length > 0 && (
                <ChunkSoloPlayersSection
                  serverId={SERVER_ID}
                  players={chunkSoloPlayersQuery.data}
                  filters={filters}
                />
              )}

            {qualifiedQuery.data && (
              <QualifiedPlayersSection players={qualifiedQuery.data} />
            )}

            <FakePartyCard data={fakePartyQuery.data ?? null} />
          </>
        )}
      </div>
    </div>
  );
}
