import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type {
  InitialDataPayload,
  ServerStatus,
  ServerStatusUpdatePayload,
} from "@createrington/shared/socket";
import { SocketEvent, SubscriptionType } from "@createrington/shared/socket";
import { useRealtimeFeed } from "@/contexts/websocket";
import type { ServerDataContextType } from "./types";
import { ServerDataContext } from "./context";

interface ServerDataProviderProps {
  children: React.ReactNode;
}

export function ServerDataProvider({ children }: ServerDataProviderProps) {
  const [serverMap, setServerMap] = useState<Map<number, ServerStatus>>(
    () => new Map(),
  );

  const handleSnapshot = useCallback((snapshot: InitialDataPayload) => {
    setServerMap(
      new Map(snapshot.servers.map((server) => [server.serverId, server])),
    );
  }, []);

  const handleUpdate = useCallback((payload: ServerStatusUpdatePayload) => {
    setServerMap((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(payload.serverId);

      updated.set(payload.serverId, {
        serverId: payload.serverId,
        serverName: existing?.serverName ?? `Server ${payload.serverId}`,
        serverSlug: payload.serverSlug ?? existing?.serverSlug ?? "",
        online: payload.online,
        maintenance: payload.maintenance,
        scheduledMaintenance: payload.scheduledMaintenance,
        playerCount: payload.playerCount,
        maxPlayers: payload.maxPlayers,
        lastUpdate: payload.timestamp,
      });

      return updated;
    });
  }, []);

  const { loading, error } = useRealtimeFeed({
    type: SubscriptionType.SERVER_STATUS,
    event: SocketEvent.UPDATE_SERVER_STATUS,
    onSnapshot: handleSnapshot,
    onUpdate: handleUpdate,
  });

  const getServer = useCallback(
    (serverId: number) => serverMap.get(serverId),
    [serverMap],
  );

  const value = useMemo<ServerDataContextType>(() => {
    const servers = Array.from(serverMap.values());

    return {
      servers,
      loading,
      error,
      stats: {
        total: servers.length,
        online: servers.filter((server) => server.online).length,
        totalPlayers: servers.reduce((sum, s) => sum + s.playerCount, 0),
        totalCapacity: servers.reduce((sum, s) => sum + s.maxPlayers, 0),
      },
      getServer,
    };
  }, [serverMap, loading, error, getServer]);

  return (
    <ServerDataContext.Provider value={value}>
      {children}
    </ServerDataContext.Provider>
  );
}
