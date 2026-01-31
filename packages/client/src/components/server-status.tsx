import * as React from "react";
import { Server } from "lucide-react";

import { cn } from "@/lib/utils";
import { useServerData } from "@/contexts/socket";
import { Loading } from "@/components/Loading";

interface ServerStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean;
}

function ServerStatus({
  className,
  isCollapsed = false,
  ...props
}: ServerStatusProps) {
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
        isCollapsed && "items-center px-3 gap-2",
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
    playerCount: number;
    maxPlayers: number;
  };
  isCollapsed: boolean;
}

function ServerStatusSingle({ server, isCollapsed }: ServerStatusSingleProps) {
  return (
    <>
      <div
        className={cn(
          "mb-3 flex min-h-6 items-center gap-3",
          isCollapsed && "mb-0 w-full justify-center gap-0",
        )}
      >
        <div
          className={cn(
            "h-3 w-3 shrink-0 rounded-full transition-all duration-200",
            server.online
              ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)] animate-pulse"
              : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
            isCollapsed && "h-4 w-4",
          )}
          title={
            isCollapsed
              ? server.online
                ? "Server Online"
                : "Server Offline"
              : undefined
          }
        />
        <span
          className={cn(
            "text-base font-semibold transition-all duration-200",
            server.online ? "text-green-500" : "text-red-500",
            isCollapsed &&
              "pointer-events-none absolute w-0 overflow-hidden opacity-0 transition-all duration-100",
          )}
        >
          {server.online ? "Online" : "Offline"}
        </span>
      </div>
      {server.online && (
        <>
          <div
            className={cn(
              "min-h-6 pl-8 text-base font-medium text-muted-foreground transition-all duration-200 delay-100",
              isCollapsed &&
                "pointer-events-none absolute opacity-0 transition-all duration-100",
            )}
          >
            {server.playerCount} / {server.maxPlayers} Players
          </div>
          {isCollapsed && (
            <div
              className={cn(
                "flex w-full min-h-7 justify-center opacity-0 transition-all duration-100 invisible",
                isCollapsed &&
                  "visible opacity-100 transition-all duration-200 delay-100",
              )}
            >
              <div
                className="rounded bg-accent px-1 py-1 text-xs font-medium text-accent-foreground"
                title={`${server.playerCount}/${server.maxPlayers} players online`}
              >
                {server.playerCount}/{server.maxPlayers}
              </div>
            </div>
          )}
        </>
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
      <div
        className={cn(
          "mb-3 flex min-h-6 items-center gap-3",
          isCollapsed && "mb-0 w-full justify-center gap-0",
        )}
      >
        <div title={isCollapsed ? "Servers" : undefined}>
          <Server
            className={cn(
              "h-5 w-5 shrink-0 text-primary transition-all duration-200",
              isCollapsed && "h-6 w-6",
            )}
          />
        </div>
        <span
          className={cn(
            "text-base font-semibold transition-all duration-200 delay-100",
            isCollapsed &&
              "pointer-events-none absolute w-0 overflow-hidden opacity-0 transition-all duration-100",
          )}
        >
          Servers
        </span>
      </div>
      <div
        className={cn(
          "flex min-h-12 flex-col gap-2 pl-8 transition-all duration-200 delay-100",
          isCollapsed &&
            "pointer-events-none absolute opacity-0 transition-all duration-100",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Online:</span>
          <span className="text-sm font-medium">
            {stats.online} / {stats.total}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Players:</span>
          <span className="text-sm font-medium">
            {stats.totalPlayers} / {stats.totalCapacity}
          </span>
        </div>
      </div>
      {isCollapsed && (
        <div className="flex flex-col gap-2 opacity-100 transition-all duration-200 delay-100">
          <div
            className="rounded bg-accent px-2 py-1 text-center text-xs font-medium text-accent-foreground"
            title={`${stats.online}/${stats.total} servers online`}
          >
            {stats.online}/{stats.total}
          </div>
          <div
            className="rounded bg-accent px-2 py-1 text-center text-xs font-medium text-accent-foreground"
            title={`${stats.totalPlayers} players online`}
          >
            {stats.totalPlayers}
          </div>
        </div>
      )}
    </>
  );
}

export { ServerStatus };
