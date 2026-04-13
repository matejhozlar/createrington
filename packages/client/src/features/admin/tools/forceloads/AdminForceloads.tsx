import { useState } from "react";
import { RefreshCw, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import { ForceloadStatsCards } from "./components/ForceloadStatsCards";
import { PlayerForceloadsTable } from "./components/PlayerForceloadsTable";
import { PartyForceloadsTable } from "./components/PartyForceloadsTable";

export function AdminForceloads() {
  const [selectedServer, setSelectedServer] = useState<string>("all");

  const serversQuery = trpc.admin.servers.list.useQuery();
  const servers = serversQuery.data?.servers ?? [];

  const serverId =
    selectedServer !== "all" ? parseInt(selectedServer, 10) : undefined;

  const statsQuery = trpc.admin.forceloads.stats.useQuery(
    { serverId },
    { enabled: !serversQuery.isLoading },
  );
  const playersQuery = trpc.admin.forceloads.players.useQuery(
    { serverId: serverId! },
    { enabled: !!serverId },
  );
  const partiesQuery = trpc.admin.forceloads.parties.useQuery(
    { serverId: serverId! },
    { enabled: !!serverId },
  );

  const isRefreshing =
    statsQuery.isFetching || playersQuery.isFetching || partiesQuery.isFetching;

  const handleRefresh = () => {
    statsQuery.refetch();
    if (serverId) {
      playersQuery.refetch();
      partiesQuery.refetch();
    }
  };

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
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh forceload data"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Forceloads</h1>

          <Select value={selectedServer} onValueChange={setSelectedServer}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Servers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.serverId} value={String(s.serverId)}>
                  {s.serverName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {statsQuery.isLoading ? (
          <Loading size="medium" text="Loading forceload data..." />
        ) : statsQuery.data ? (
          <ForceloadStatsCards stats={statsQuery.data} />
        ) : null}

        {!serverId ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <MapPin className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select a server to view forceloaded chunks
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {playersQuery.isLoading ? (
              <Loading size="medium" text="Loading players..." />
            ) : playersQuery.data ? (
              <PlayerForceloadsTable players={playersQuery.data} />
            ) : null}

            {partiesQuery.isLoading ? (
              <Loading size="medium" text="Loading parties..." />
            ) : partiesQuery.data ? (
              <PartyForceloadsTable parties={partiesQuery.data} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
