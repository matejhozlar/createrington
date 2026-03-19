import * as React from "react";
import { Server } from "lucide-react";

import { cn } from "@/lib/utils";
import { useServerData } from "@/contexts/server-data";
import { useSidebar } from "@/components/ui/sidebar";
import { Loading } from "./loading-spinner";
import { useIsMobile } from "@/hooks/use-mobile";

function ServerStatus({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = !isMobile && state === "collapsed";
  const {
    servers,
    stats: serverStats,
    loading: serversLoading,
  } = useServerData();

  // Check if single server or multiple
  const isSingleServer = servers.length === 1;
  const singleServer = isSingleServer ? servers[0] : null;

  if (serversLoading) {
    return (
      <div
        className={cn(
          "flex h-30 flex-col items-center justify-center border-b border-border px-5 py-5",
          isCollapsed && "px-3",
          className,
        )}
        {...props}
      >
        <Loading mode="inline" size="small" text="" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-center border-b border-border px-5 pb-3",
        isCollapsed && "items-center px-0 gap-2",
        className,
      )}
      {...props}
    >
      {isSingleServer && singleServer ? (
        <ServerStatusSingle server={singleServer} isCollapsed={isCollapsed} />
      ) : (
        <ServerStatusMultiple stats={serverStats} isCollapsed={isCollapsed} />
      )}
    </div>
  );
}

interface ServerStatusSingleProps {
  server: {
    online: boolean;
    maintenance: boolean;
    playerCount: number;
    maxPlayers: number;
  };
  isCollapsed: boolean;
}

function ServerStatusSingle({ server, isCollapsed }: ServerStatusSingleProps) {
  const statusLabel = server.maintenance
    ? "Maintenance"
    : server.online
      ? "Online"
      : "Offline";

  return (
    <>
      <div className="flex items-center min-h-6 gap-3">
        {/* Indicator Light */}
        <div
          className={cn("size-3 shrink-0 rounded-full", {
            "bg-amber-500 shadow shadow-amber-500 animate-pulse":
              server.maintenance,
            "bg-green-500 shadow shadow-green-500 animate-pulse":
              !server.maintenance && server.online,
            "bg-destructive shadow shadow-destructive":
              !server.maintenance && !server.online,
            "size-4": isCollapsed,
          })}
        />

        {/* Status Title */}
        {!isCollapsed && (
          <span
            className={cn("text-base font-semibold", {
              "text-amber-500": server.maintenance,
              "text-green-500": !server.maintenance && server.online,
              "text-destructive": !server.maintenance && !server.online,
            })}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Player Count */}
      {server.online && !server.maintenance && (
        <div
          className={cn(
            "min-h-6 text-base whitespace-nowrap font-medium text-muted-foreground",
            {
              "justify-center": isCollapsed,
              "pl-6": !isCollapsed,
            },
          )}
        >
          {server.playerCount} / {server.maxPlayers}
          {!isCollapsed && <span className="ml-2 truncate">Players</span>}
        </div>
      )}
    </>
  );
}

interface ServerStatusMultipleProps {
  stats: {
    online: number;
    total: number;
    totalPlayers: number;
    totalCapacity: number;
  };
  isCollapsed: boolean;
}

function ServerStatusMultiple({
  stats,
  isCollapsed,
}: ServerStatusMultipleProps) {
  return (
    <>
      {/* Icon and Title */}
      <div className="flex items-center min-h-6 gap-3">
        <Server className={cn("size-5 text-primary")} />

        {!isCollapsed && (
          <span className="text-base font-semibold">Servers</span>
        )}
      </div>

      <div
        className={cn("flex min-h-12 flex-col gap-2", {
          "pl-8": !isCollapsed,
        })}
      >
        {/* Server Count */}
        <div
          className={cn("flex items-center whitespace-nowrap text-sm", {
            "justify-between": !isCollapsed,
            "justify-center": isCollapsed,
          })}
        >
          {!isCollapsed && (
            <span className="text-muted-foreground truncate">Online:</span>
          )}

          <span className="font-medium">
            {stats.online} / {stats.total}
          </span>
        </div>

        {/* Player Count */}
        <div className="flex items-center justify-between whitespace-nowrap text-sm">
          {!isCollapsed && (
            <span className="text-muted-foreground truncate">Players:</span>
          )}

          <span className="font-medium">
            {stats.totalPlayers} / {stats.totalCapacity}
          </span>
        </div>
      </div>
    </>
  );
}

export { ServerStatus };
