import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useContext,
} from "react";
import type {
  ServerStatus,
  ServerStatusUpdatePayload,
  SubscriptionType,
} from "@createrington/shared/socket";
import { WebSocketContext } from "@/contexts/websocket";
import type { ServerDataContextType } from "./types";
import { ServerDataContext } from "./context";

interface ServerDataProviderProps {
  children: React.ReactNode;
  /** Auto-subscribe to server status updates */
  autoSubscribe?: boolean;
  /** Specific server IDs to track (if not provided, tracks all) */
  serverIds?: number[];
}

/**
 * Server Data Provider
 *
 * Manages real-time server status data from WebSocket
 *
 * Features:
 * - Tracks all server statuses
 * - Auto-updates from WebSocket events
 * - Subscription management
 * - Server filtering
 * - Computed statistics
 */
export function ServerDataProvider({
  children,
  autoSubscribe = true,
  serverIds,
}: ServerDataProviderProps) {
  // Get WebSocket context directly to avoid circular dependency
  const websocketContext = useContext(WebSocketContext);

  if (!websocketContext) {
    throw new Error("ServerDataProvider must be used within WebSocketProvider");
  }

  const { isConnected, on, subscribe, unsubscribe, requestInitialData } =
    websocketContext;

  const [servers, setServers] = useState<Map<number, ServerStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);

  const loadInitialData = useCallback(() => {
    return requestInitialData(undefined, {
      includeMessages: false,
    })
      .then((data) => {
        setError(null);

        if (data && "servers" in data) {
          const serverMap = new Map<number, ServerStatus>();

          data.servers.forEach((server: ServerStatus) => {
            // Filter by serverIds if provided
            if (!serverIds || serverIds.includes(server.serverId)) {
              serverMap.set(server.serverId, {
                ...server,
                lastUpdate:
                  typeof server.lastUpdate === "string"
                    ? new Date(server.lastUpdate)
                    : server.lastUpdate,
              });
            }
          });

          setServers(serverMap);
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV)
          console.error("Failed to load initial server data:", error);
        setError(
          error instanceof Error
            ? error
            : new Error("Failed to load server data"),
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [requestInitialData, serverIds]);

  const handleServerStatusUpdate = useCallback(
    (payload: ServerStatusUpdatePayload) => {
      // Filter by serverIds if provided
      if (serverIds && !serverIds.includes(payload.serverId)) {
        return;
      }

      setServers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(payload.serverId);

        updated.set(payload.serverId, {
          serverId: payload.serverId,
          serverName: existing?.serverName || `Server ${payload.serverId}`,
          online: payload.online,
          maintenance: payload.maintenance,
          scheduledMaintenance: payload.scheduledMaintenance,
          playerCount: payload.playerCount,
          maxPlayers: payload.maxPlayers,
          lastUpdate:
            typeof payload.timestamp === "string"
              ? new Date(payload.timestamp)
              : payload.timestamp,
        });

        return updated;
      });
    },
    [serverIds],
  );

  const subscribeToUpdates = useCallback(() => {
    const subscribeAll = async () => {
      if (serverIds) {
        // Subscribe to specific servers
        for (const serverId of serverIds) {
          await subscribe("server:status" as SubscriptionType, serverId);
        }
      } else {
        // Subscribe to all servers
        await subscribe("server:status" as SubscriptionType);
      }
    };

    return subscribeAll()
      .then(() => {
        setIsSubscribed(true);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV)
          console.error("Failed to subscribe to server updates:", error);
        setError(
          error instanceof Error
            ? error
            : new Error("Failed to subscribe to updates"),
        );
      });
  }, [subscribe, serverIds]);

  const unsubscribeFromUpdates = useCallback(async () => {
    try {
      if (serverIds) {
        for (const serverId of serverIds) {
          await unsubscribe("server:status" as SubscriptionType, serverId);
        }
      } else {
        await unsubscribe("server:status" as SubscriptionType);
      }

      setIsSubscribed(false);
    } catch (error) {
      if (import.meta.env.DEV)
        console.error("Failed to unsubscribe from server updates:", error);
    }
  }, [unsubscribe, serverIds]);

  const getServer = useCallback(
    (serverId: number): ServerStatus | undefined => {
      return servers.get(serverId);
    },
    [servers],
  );

  const getAllServers = useCallback((): ServerStatus[] => {
    return Array.from(servers.values());
  }, [servers]);

  const getOnlineServers = useCallback((): ServerStatus[] => {
    return Array.from(servers.values()).filter((server) => server.online);
  }, [servers]);

  const getOfflineServers = useCallback((): ServerStatus[] => {
    return Array.from(servers.values()).filter((server) => !server.online);
  }, [servers]);

  const isServerOnline = useCallback(
    (serverId: number): boolean => {
      return servers.get(serverId)?.online ?? false;
    },
    [servers],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadInitialData();
  }, [loadInitialData]);

  const stats = useMemo(() => {
    const allServers = Array.from(servers.values());
    const onlineServers = allServers.filter((s) => s.online);

    return {
      total: allServers.length,
      online: onlineServers.length,
      offline: allServers.length - onlineServers.length,
      totalPlayers: allServers.reduce((sum, s) => sum + s.playerCount, 0),
      totalCapacity: allServers.reduce((sum, s) => sum + s.maxPlayers, 0),
      averageLoad:
        onlineServers.length > 0
          ? onlineServers.reduce(
              (sum, s) => sum + s.playerCount / s.maxPlayers,
              0,
            ) / onlineServers.length
          : 0,
    };
  }, [servers]);

  useEffect(() => {
    if (isConnected) {
      loadInitialData();

      if (autoSubscribe) {
        subscribeToUpdates();
      }
    }
  }, [isConnected, loadInitialData, autoSubscribe, subscribeToUpdates]);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on("update:server:status", (data) => {
      handleServerStatusUpdate(data as ServerStatusUpdatePayload);
    });

    return unsubscribe;
  }, [isConnected, on, handleServerStatusUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribeFromUpdates();
      }
    };
  }, [isSubscribed, unsubscribeFromUpdates]);

  const value: ServerDataContextType = {
    servers: Array.from(servers.values()),
    serverMap: servers,
    loading,
    error,
    stats,
    isSubscribed,

    // Methods
    getServer,
    getAllServers,
    getOnlineServers,
    getOfflineServers,
    isServerOnline,
    refresh,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };

  return React.createElement(ServerDataContext.Provider, { value }, children);
}
