import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { useServerData, usePlayerData } from "@/contexts/socket";
import type {
  GetAdminPlayersResponse,
  GetAdminPlayerStatsResponse,
  AdminPlayerStats,
  GetAdminPlayersQuery,
} from "@createrington/shared/api";
import { AdminPlayerContextType } from "./types";
import { AdminPlayersContext } from "./context";

interface AdminPlayerProviderProps {
  children: React.ReactNode;
}

export const AdminPlayerProvider: React.FC<AdminPlayerProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const { servers } = useServerData(); // Get server data
  const { players: onlinePlayers, isPlayerOnline: checkOnline } =
    usePlayerData(); // Get player data

  const [stats, setStats] = useState<AdminPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Get server name by ID from WebSocket data
   */
  const getServerName = useCallback(
    (serverId: number): string => {
      const server = servers.find((s) => s.serverId === serverId);
      return server?.serverName || `Server ${serverId}`;
    },
    [servers],
  );

  /**
   * Check if player is online using WebSocket data
   */
  const isPlayerOnline = useCallback(
    (minecraftUuid: string): boolean => {
      return checkOnline(minecraftUuid);
    },
    [checkOnline],
  );

  /**
   * Get current server ID for online player
   */
  const getPlayerServerId = useCallback(
    (minecraftUuid: string): number | null => {
      const player = onlinePlayers.find((p) => p.uuid === minecraftUuid);
      return player?.serverId || null;
    },
    [onlinePlayers],
  );

  /**
   * Fetch player statistics for dashboard
   */
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/admin/players/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetAdminPlayerStatsResponse = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch player stats:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch stats"));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch players with filters
   */
  const fetchPlayers = useCallback(async (query?: GetAdminPlayersQuery) => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const params = new URLSearchParams();
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/api/admin/players${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetAdminPlayersResponse = await response.json();

      if (data.success) {
        return data;
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch players:", err);
      throw err;
    }
  }, []);

  /**
   * Refresh stats manually
   */
  const refreshStats = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  // Load initial stats when user is admin
  useEffect(() => {
    if (user?.isAdmin) {
      fetchStats();
    }
  }, [user?.isAdmin, fetchStats]);

  const value: AdminPlayerContextType = {
    stats,
    loading,
    error,
    refreshStats,
    fetchPlayers,
    getServerName,
    isPlayerOnline,
    getPlayerServerId,
  };

  return (
    <AdminPlayersContext.Provider value={value}>
      {children}
    </AdminPlayersContext.Provider>
  );
};
