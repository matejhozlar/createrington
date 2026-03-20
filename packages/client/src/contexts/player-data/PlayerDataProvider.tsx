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
export const PlayerDataProvider: React.FC<PlayerDataProviderProps> = ({
  children,
  autoSubscribe = true,
  serverIds,
}) => {
  // Get WebSocket context directly to avoid circular dependency
  const websocketContext = useContext(WebSocketContext);

  if (!websocketContext) {
    throw new Error("PlayerDataProvider must be used within WebSocketProvider");
  }

  const { isConnected, on, subscribe, unsubscribe, requestInitialData } =
    websocketContext;

  // Player map: uuid -> PlayerData
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscription tracking
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Recent events for notifications
  const [recentJoins, setRecentJoins] = useState<PlayerData[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<PlayerData[]>([]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  /**
   * Load initial player data
   */
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await requestInitialData(undefined, {
        includeMessages: false,
      });

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
      }
    } catch (err) {
      if (import.meta.env.DEV)
        console.error("Failed to load initial player data:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to load player data"),
      );
    } finally {
      setLoading(false);
    }
  }, [requestInitialData, serverIds]);

  // ============================================================================
  // Real-time Updates
  // ============================================================================

  /**
   * Handle player update from WebSocket
   */
  const handlePlayersUpdate = useCallback(
    (payload: PlayersUpdatePayload) => {
      // Filter by serverIds if provided
      if (serverIds && !serverIds.includes(payload.serverId)) {
        return;
      }

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

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe to player updates
   */
  const subscribeToUpdates = useCallback(async () => {
    try {
      if (serverIds) {
        // Subscribe to specific servers
        for (const serverId of serverIds) {
          await subscribe("players" as SubscriptionType, serverId);
        }
      } else {
        // Subscribe to all servers
        await subscribe("players" as SubscriptionType);
      }

      setIsSubscribed(true);
    } catch (err) {
      if (import.meta.env.DEV)
        console.error("Failed to subscribe to player updates:", err);
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to subscribe to updates"),
      );
    }
  }, [subscribe, serverIds]);

  /**
   * Unsubscribe from player updates
   */
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
    } catch (err) {
      if (import.meta.env.DEV)
        console.error("Failed to unsubscribe from player updates:", err);
    }
  }, [unsubscribe, serverIds]);

  // ============================================================================
  // Data Access Methods
  // ============================================================================

  /**
   * Get player by UUID
   */
  const getPlayer = useCallback(
    (uuid: string): PlayerData | undefined => {
      return players.get(uuid);
    },
    [players],
  );

  /**
   * Get player by username (case-insensitive)
   */
  const getPlayerByUsername = useCallback(
    (username: string): PlayerData | undefined => {
      const lowerUsername = username.toLowerCase();
      return Array.from(players.values()).find(
        (p) => p.username.toLowerCase() === lowerUsername,
      );
    },
    [players],
  );

  /**
   * Get all players as array
   */
  const getAllPlayers = useCallback((): PlayerData[] => {
    return Array.from(players.values());
  }, [players]);

  /**
   * Get players on specific server
   */
  const getServerPlayers = useCallback(
    (serverId: number): PlayerData[] => {
      return Array.from(players.values()).filter(
        (player) => player.serverId === serverId,
      );
    },
    [players],
  );

  /**
   * Check if player is online
   */
  const isPlayerOnline = useCallback(
    (uuid: string): boolean => {
      return players.has(uuid);
    },
    [players],
  );

  /**
   * Get player count for server
   */
  const getServerPlayerCount = useCallback(
    (serverId: number): number => {
      return getServerPlayers(serverId).length;
    },
    [getServerPlayers],
  );

  /**
   * Refresh player data
   */
  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  /**
   * Clear recent join/leave history
   */
  const clearRecentEvents = useCallback(() => {
    setRecentJoins([]);
    setRecentLeaves([]);
  }, []);

  // ============================================================================
  // Computed Statistics
  // ============================================================================

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
    const now = Date.now();
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
  }, [players, recentJoins, recentLeaves]);

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Load initial data when connected
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

  // ============================================================================
  // Context Value
  // ============================================================================

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
};
