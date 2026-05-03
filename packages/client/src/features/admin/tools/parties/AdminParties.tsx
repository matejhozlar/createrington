import { useMemo, useState } from "react";
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
import { ChunkTablesCard } from "./components/ChunkTablesCard";
import { PartiesEmptyState } from "./components/PartiesEmptyState";
import { PartiesFiltersBar } from "./components/PartiesFiltersBar";
import { PartiesKpiCards } from "./components/PartiesKpiCards";
import type { PartyFilters } from "./types";

// TODO: restore server selector when multi-server support returns
const SERVER_ID = 1;
const POST_RESYNC_REFETCH_MS = 2000;
const SOLO_PLAYERS_PER_PAGE = 50;

const DEFAULT_FILTERS: PartyFilters = {
  search: "",
  dimension: "all",
  allied: "all",
  activeForceloadsOnly: false,
  optedIn: "all",
};

export function AdminParties() {
  const toast = useToastActions();
  const [filters, setFilters] = useState<PartyFilters>(DEFAULT_FILTERS);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  // Solo players are only meaningful when party-scoped filters are inactive.
  const soloPlayersEnabled =
    filters.allied !== "allied" && filters.optedIn === "all";

  // Reset solo page on any filter change that affects the result set
  // (the "store information from previous render" pattern from React docs).
  const soloFiltersKey = `${filters.search}|${filters.activeForceloadsOnly}|${soloPlayersEnabled}`;
  const [soloPage, setSoloPage] = useState(0);
  const [prevSoloFiltersKey, setPrevSoloFiltersKey] = useState(soloFiltersKey);
  if (prevSoloFiltersKey !== soloFiltersKey) {
    setPrevSoloFiltersKey(soloFiltersKey);
    setSoloPage(0);
  }

  const kpisQuery = trpc.admin.parties.kpis.useQuery({ serverId: SERVER_ID });
  const chunkKpisQuery = trpc.admin.parties.chunkKpis.useQuery({
    serverId: SERVER_ID,
  });
  const chunkPartiesQuery = trpc.admin.parties.chunkParties.useQuery({
    serverId: SERVER_ID,
  });
  const chunkDimensionsQuery = trpc.admin.parties.chunkDimensions.useQuery({
    serverId: SERVER_ID,
  });
  const chunkSoloPlayersQuery = trpc.admin.parties.chunkSoloPlayers.useQuery(
    {
      serverId: SERVER_ID,
      page: soloPage,
      limit: SOLO_PLAYERS_PER_PAGE,
      search: filters.search.trim() || undefined,
      activeOnly: filters.activeForceloadsOnly || undefined,
    },
    { enabled: soloPlayersEnabled },
  );
  const fakePartyQuery = trpc.admin.parties.fakeParty.useQuery({
    serverId: SERVER_ID,
  });
  const resyncMutation = trpc.admin.parties.resync.useMutation();

  const isRefreshing =
    kpisQuery.isFetching ||
    chunkKpisQuery.isFetching ||
    chunkPartiesQuery.isFetching ||
    chunkSoloPlayersQuery.isFetching ||
    fakePartyQuery.isFetching ||
    resyncMutation.isPending;

  const refetchAll = () => {
    kpisQuery.refetch();
    chunkKpisQuery.refetch();
    chunkPartiesQuery.refetch();
    chunkSoloPlayersQuery.refetch();
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
    !fakePartyQuery.isLoading;

  const hasAnyData =
    (chunkPartiesQuery.data?.length ?? 0) > 0 ||
    (chunkKpisQuery.data?.totalChunks ?? 0) > 0 ||
    !!fakePartyQuery.data;

  // Filter parties client-side (moved here so the tab trigger can show counts)
  const allParties = chunkPartiesQuery.data;
  const filteredParties = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return (allParties ?? []).filter((p) => {
      if (filters.allied === "allied" && !p.isAllied) return false;
      if (filters.allied === "notAllied" && p.isAllied) return false;
      if (filters.activeForceloadsOnly && p.activeChunks === 0) return false;
      if (filters.optedIn === "optedIn" && p.partyOptedIn !== true)
        return false;
      if (filters.optedIn === "optedOut" && p.partyOptedIn !== false)
        return false;
      if (needle && !p.partyName.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allParties, filters]);
  const totalParties = allParties?.length ?? 0;

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
            fakeParty={fakePartyQuery.data ?? null}
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
            <PartiesFiltersBar
              filters={filters}
              onChange={setFilters}
              dimensions={chunkDimensionsQuery.data ?? []}
            />

            <ChunkTablesCard
              serverId={SERVER_ID}
              filteredParties={filteredParties}
              totalParties={totalParties}
              filters={filters}
              soloPlayersEnabled={soloPlayersEnabled}
              soloData={chunkSoloPlayersQuery.data}
              soloIsLoading={chunkSoloPlayersQuery.isLoading}
              onSoloPageChange={setSoloPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
