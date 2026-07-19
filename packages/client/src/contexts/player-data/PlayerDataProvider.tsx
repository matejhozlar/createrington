import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useContext,
} from "react";
import type {
  PlayerData,
  PlayersUpdatePayload,
  SubscriptionType,
} from "@createrington/shared/socket";
import { WebSocketContext } from "@/contexts/websocket";
import type { PlayerDataContextType } from "./types";
import { PlayerDataContext } from "./context";

interface PlayerDataProviderProps {
  children: React.ReactNode;
  /** Auto-subscribe to player updates */
  autoSubscribe?: boolean;
  /** Specific server IDs to track (if not provided, tracks all) */
  serverIds?: number[];
}

/**
 * Player Data Provider
 *
 * Manages real-time player data from WebSocket
 *
 * Features:
 * - Tracks all online players
 * - Auto-updates from WebSocket events
 * - Player join/leave notifications
 * - Server filtering
 * - Session tracking
 * - Computed statistics
 */
export function PlayerDataProvider({
  children,
  autoSubscribe = true,
  serverIds,
}: PlayerDataProviderProps) {
  // Get WebSocket context directly to avoid circular dependency
  const websocketContext = useContext(WebSocketContext);

  if (!websocketContext) {
    throw new Error("PlayerDataProvider must be used within WebSocketProvider");
  }

  const { isConnected, on, subscribe, unsubscribe, requestInitialData } =
    websocketContext;

  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);

  // Recent events for notifications.
  const [recentJoins, setRecentJoins] = useState<PlayerData[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<PlayerData[]>([]);

  // Reference time for session-duration stats, captured whenever player data
  // changes so the stats memo stays pure (no Date.now() during render).
  const [playersUpdatedAt, setPlayersUpdatedAt] = useState(0);

  const loadInitialData = useCallback(() => {
    return requestInitialData(undefined, {
      includeMessages: false,
    })
      .then((data) => {
        setError(null);

        if (data && "players" in data) {
          const playerMap = new Map<string, PlayerData>();

          data.players.forEach((player: PlayerData) => {
            // Filter by serverIds if provided
            if (!serverIds || serverIds.includes(player.serverId)) {
              playerMap.set(player.uuid, {
                ...player,
                sessionStart:
                  typeof player.sessionStart === "string"
                    ? new Date(player.sessionStart)
                    : player.sessionStart,
              });
            }
          });

          setPlayers(playerMap);
          setPlayersUpdatedAt(Date.now());
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV)
          console.error("Failed to load initial player data:", error);
        setError(
          error instanceof Error
            ? error
            : new Error("Failed to load player data"),
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [requestInitialData, serverIds]);

  const handlePlayersUpdate = useCallback(
    (payload: PlayersUpdatePayload) => {
      // Filter by serverIds if provided
      if (serverIds && !serverIds.includes(payload.serverId)) {
        return;
      }

      setPlayersUpdatedAt(Date.now());

      switch (payload.type) {
        case "join":
          if (payload.player) {
            const player = {
              ...payload.player,
              sessionStart:
                typeof payload.player.sessionStart === "string"
                  ? new Date(payload.player.sessionStart)
                  : payload.player.sessionStart,
            };

            setPlayers((prev) => {
              const updated = new Map(prev);
              updated.set(player.uuid, player);
              return updated;
            });

            // Add to recent joins
            setRecentJoins((prev) => {
              const updated = [player, ...prev.slice(0, 9)]; // Keep last 10
              return updated;
            });
          }
          break;

        case "leave":
          if (payload.player) {
            const player = {
              ...payload.player,
              sessionStart:
                typeof payload.player.sessionStart === "string"
                  ? new Date(payload.player.sessionStart)
                  : payload.player.sessionStart,
            };

            setPlayers((prev) => {
              const updated = new Map(prev);
              updated.delete(player.uuid);
              return updated;
            });

            // Add to recent leaves
            setRecentLeaves((prev) => {
              const updated = [player, ...prev.slice(0, 9)]; // Keep last 10
              return updated;
            });
          }
          break;

        case "sync":
          if (payload.players) {
            const playerMap = new Map<string, PlayerData>();

            payload.players.forEach((player) => {
              if (!serverIds || serverIds.includes(player.serverId)) {
                playerMap.set(player.uuid, {
                  ...player,
                  sessionStart:
                    typeof player.sessionStart === "string"
                      ? new Date(player.sessionStart)
                      : player.sessionStart,
                });
              }
            });

            setPlayers(playerMap);
          }
          break;
      }
    },
    [serverIds],
  );

  const subscribeToUpdates = useCallback(() => {
    const subscribeAll = async () => {
      if (serverIds) {
        // Subscribe to specific servers
        for (const serverId of serverIds) {
          await subscribe("players" as SubscriptionType, serverId);
        }
      } else {
        // Subscribe to all servers
        await subscribe("players" as SubscriptionType);
      }
    };

    return subscribeAll()
      .then(() => {
        setIsSubscribed(true);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV)
          console.error("Failed to subscribe to player updates:", error);
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
          await unsubscribe("players" as SubscriptionType, serverId);
        }
      } else {
        await unsubscribe("players" as SubscriptionType);
      }

      setIsSubscribed(false);
    } catch (error) {
      if (import.meta.env.DEV)
        console.error("Failed to unsubscribe from player updates:", error);
    }
  }, [unsubscribe, serverIds]);

  const getPlayer = useCallback(
    (uuid: string): PlayerData | undefined => {
      return players.get(uuid);
    },
    [players],
  );

  /** Case-insensitive lookup by username. */
  const getPlayerByUsername = useCallback(
    (username: string): PlayerData | undefined => {
      const lowerUsername = username.toLowerCase();
      return Array.from(players.values()).find(
        (p) => p.username.toLowerCase() === lowerUsername,
      );
    },
    [players],
  );

  const getAllPlayers = useCallback((): PlayerData[] => {
    return Array.from(players.values());
  }, [players]);

  const getServerPlayers = useCallback(
    (serverId: number): PlayerData[] => {
      return Array.from(players.values()).filter(
        (player) => player.serverId === serverId,
      );
    },
    [players],
  );

  const isPlayerOnline = useCallback(
    (uuid: string): boolean => {
      return players.has(uuid);
    },
    [players],
  );

  const getServerPlayerCount = useCallback(
    (serverId: number): number => {
      return getServerPlayers(serverId).length;
    },
    [getServerPlayers],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadInitialData();
  }, [loadInitialData]);

  const clearRecentEvents = useCallback(() => {
    setRecentJoins([]);
    setRecentLeaves([]);
  }, []);

  const stats = useMemo(() => {
    const allPlayers = Array.from(players.values());

    // Group by server
    const byServer = allPlayers.reduce(
      (acc, player) => {
        acc[player.serverId] = (acc[player.serverId] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    // Calculate average session duration
    const now = playersUpdatedAt;
    const totalSessionTime = allPlayers.reduce((sum, player) => {
      const sessionStart =
        player.sessionStart instanceof Date
          ? player.sessionStart.getTime()
          : new Date(player.sessionStart).getTime();
      return sum + (now - sessionStart);
    }, 0);

    const averageSessionDuration =
      allPlayers.length > 0 ? totalSessionTime / allPlayers.length / 1000 : 0; // in seconds

    return {
      total: allPlayers.length,
      byServer,
      averageSessionDuration,
      recentJoins: recentJoins.length,
      recentLeaves: recentLeaves.length,
    };
  }, [players, playersUpdatedAt, recentJoins, recentLeaves]);

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

    const unsubscribe = on("update:players", (data) => {
      handlePlayersUpdate(data as PlayersUpdatePayload);
    });

    return unsubscribe;
  }, [isConnected, on, handlePlayersUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribeFromUpdates();
      }
    };
  }, [isSubscribed, unsubscribeFromUpdates]);

  const value: PlayerDataContextType = {
    players: Array.from(players.values()),
    playerMap: players,
    loading,
    error,
    stats,
    isSubscribed,
    recentJoins,
    recentLeaves,

    // Methods
    getPlayer,
    getPlayerByUsername,
    getAllPlayers,
    getServerPlayers,
    isPlayerOnline,
    getServerPlayerCount,
    refresh,
    clearRecentEvents,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };

  return React.createElement(PlayerDataContext.Provider, { value }, children);
}
