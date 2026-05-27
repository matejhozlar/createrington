import type React from "react";
import { useCallback } from "react";
import { useServerData } from "@/contexts/server-data";
import { usePlayerData } from "@/contexts/player-data";
import type { AdminPlayerContextType } from "./types";
import { AdminPlayersContext } from "./context";

interface AdminPlayerProviderProps {
  children: React.ReactNode;
}

export function AdminPlayerProvider({ children }: AdminPlayerProviderProps) {
  const { servers } = useServerData();
  const { players: onlinePlayers, isPlayerOnline: checkOnline } =
    usePlayerData();

  const getServerName = useCallback(
    (serverId: number): string => {
      const server = servers.find((s) => s.serverId === serverId);
      return server?.serverName || `Server ${serverId}`;
    },
    [servers],
  );

  const isPlayerOnline = useCallback(
    (minecraftUuid: string): boolean => {
      return checkOnline(minecraftUuid);
    },
    [checkOnline],
  );

  const getPlayerServerId = useCallback(
    (minecraftUuid: string): number | null => {
      const player = onlinePlayers.find((p) => p.uuid === minecraftUuid);
      return player?.serverId ?? null;
    },
    [onlinePlayers],
  );

  const value: AdminPlayerContextType = {
    getServerName,
    isPlayerOnline,
    getPlayerServerId,
  };

  return (
    <AdminPlayersContext.Provider value={value}>
      {children}
    </AdminPlayersContext.Provider>
  );
}
