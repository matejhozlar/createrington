import { useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToastActions } from "@/hooks/use-toast";
import { DIMENSIONS } from "@/lib/minecraft";
import { formatRelativeDate } from "@/features/admin/format";
import { ForceloadStatsCards } from "./components/ForceloadStatsCards";
import { PlayerForceloadsTable } from "./components/PlayerForceloadsTable";
import { PartyForceloadsTable } from "./components/PartyForceloadsTable";
import { ForceloadEmptyState } from "./components/ForceloadEmptyState";

// TODO: restore server selector when multi-server support returns
const SERVER_ID = 1;

const POST_RESYNC_REFETCH_MS = 2000;

export type DimensionFilter = "all" | (typeof DIMENSIONS)[number]["id"];

export function AdminForceloads() {
  const toast = useToastActions();
  const [search, setSearch] = useState("");
  const [dimensionFilter, setDimensionFilter] =
    useState<DimensionFilter>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const statsQuery = trpc.admin.forceloads.stats.useQuery({
    serverId: SERVER_ID,
  });
  const playersQuery = trpc.admin.forceloads.players.useQuery({
    serverId: SERVER_ID,
  });
  const partiesQuery = trpc.admin.forceloads.parties.useQuery({
    serverId: SERVER_ID,
  });

  const resyncMutation = trpc.admin.forceloads.resync.useMutation();

  const isRefreshing =
    statsQuery.isFetching ||
    playersQuery.isFetching ||
    partiesQuery.isFetching ||
    resyncMutation.isPending;

  const refetchAll = () => {
    statsQuery.refetch();
    playersQuery.refetch();
    partiesQuery.refetch();
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

  const hasAnyData =
    (playersQuery.data?.length ?? 0) > 0 ||
    (partiesQuery.data?.length ?? 0) > 0;

  const loaded =
    !statsQuery.isLoading && !playersQuery.isLoading && !partiesQuery.isLoading;

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
              <BreadcrumbPage>Forceloads</BreadcrumbPage>
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
              aria-label="Resync forceload data"
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
            <h1 className="text-2xl font-semibold">Forceloads</h1>
            {lastRefreshedAt && (
              <p className="text-xs text-muted-foreground">
                Last refreshed{" "}
                {formatRelativeDate(lastRefreshedAt.toISOString())}
              </p>
            )}
          </div>
        </div>

        {statsQuery.isLoading ? (
          <Loading size="medium" text="Loading forceload data..." />
        ) : statsQuery.data ? (
          <ForceloadStatsCards stats={statsQuery.data} />
        ) : null}

        {loaded && !hasAnyData ? (
          <ForceloadEmptyState
            onResync={handleResync}
            isResyncing={isRefreshing}
          />
        ) : (
          <>
            <FiltersBar
              search={search}
              onSearchChange={setSearch}
              dimension={dimensionFilter}
              onDimensionChange={setDimensionFilter}
              activeOnly={activeOnly}
              onActiveOnlyChange={setActiveOnly}
            />

            <div className="flex flex-col gap-4">
              {playersQuery.isLoading ? (
                <Loading size="medium" text="Loading players..." />
              ) : playersQuery.data ? (
                <PlayerForceloadsTable
                  players={playersQuery.data}
                  search={search}
                  dimensionFilter={dimensionFilter}
                  activeOnly={activeOnly}
                />
              ) : null}

              {partiesQuery.isLoading ? (
                <Loading size="medium" text="Loading parties..." />
              ) : partiesQuery.data ? (
                <PartyForceloadsTable
                  parties={partiesQuery.data}
                  search={search}
                  dimensionFilter={dimensionFilter}
                  activeOnly={activeOnly}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FiltersBar({
  search,
  onSearchChange,
  dimension,
  onDimensionChange,
  activeOnly,
  onActiveOnlyChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  dimension: DimensionFilter;
  onDimensionChange: (v: DimensionFilter) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
}) {
  const activeCount =
    (search.trim() ? 1 : 0) +
    (dimension !== "all" ? 1 : 0) +
    (activeOnly ? 1 : 0);

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-muted-foreground" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by player or party name..."
              className="pl-9"
            />
          </div>

          <Select
            value={dimension}
            onValueChange={(v) => onDimensionChange(v as DimensionFilter)}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Dimension" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dimensions</SelectItem>
              {DIMENSIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3">
            <Switch
              id="forceloads-active-only"
              checked={activeOnly}
              onCheckedChange={onActiveOnlyChange}
            />
            <Label
              htmlFor="forceloads-active-only"
              className="cursor-pointer text-sm font-medium"
            >
              Active only
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
