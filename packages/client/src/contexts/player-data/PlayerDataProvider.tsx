import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type {
  InitialDataPayload,
  PlayerData,
  PlayersUpdatePayload,
} from "@createrington/shared/socket";
import { SocketEvent, SubscriptionType } from "@createrington/shared/socket";
import { useRealtimeFeed } from "@/contexts/websocket";
import type { OnlinePlayer, PlayerDataContextType } from "./types";
import { PlayerDataContext } from "./context";

interface PlayerDataProviderProps {
  children: React.ReactNode;
}

function toOnlinePlayer(player: PlayerData): OnlinePlayer {
  return { ...player, sessionStart: new Date(player.sessionStart) };
}

function toPlayerMap(players: PlayerData[]): Map<string, OnlinePlayer> {
  return new Map(
    players.map((player) => [player.uuid, toOnlinePlayer(player)]),
  );
}

export function PlayerDataProvider({ children }: PlayerDataProviderProps) {
  const [playerMap, setPlayerMap] = useState<Map<string, OnlinePlayer>>(
    () => new Map(),
  );

  const handleSnapshot = useCallback((snapshot: InitialDataPayload) => {
    setPlayerMap(toPlayerMap(snapshot.players));
  }, []);

  const handleUpdate = useCallback((payload: PlayersUpdatePayload) => {
    const { type, player, players } = payload;

    if (type === "sync") {
      if (players) setPlayerMap(toPlayerMap(players));
      return;
    }
    if (!player) return;

    setPlayerMap((prev) => {
      const updated = new Map(prev);
      if (type === "join") {
        updated.set(player.uuid, toOnlinePlayer(player));
      } else {
        updated.delete(player.uuid);
      }
      return updated;
    });
  }, []);

  const { loading, error, refresh } = useRealtimeFeed({
    type: SubscriptionType.PLAYERS,
    event: SocketEvent.UPDATE_PLAYERS,
    onSnapshot: handleSnapshot,
    onUpdate: handleUpdate,
  });

  const players = useMemo(() => Array.from(playerMap.values()), [playerMap]);

  const getServerPlayers = useCallback(
    (serverId: number) =>
      players.filter((player) => player.serverId === serverId),
    [players],
  );

  const isPlayerOnline = useCallback(
    (uuid: string) => playerMap.has(uuid),
    [playerMap],
  );

  const value = useMemo<PlayerDataContextType>(
    () => ({
      players,
      loading,
      error,
      getServerPlayers,
      isPlayerOnline,
      refresh,
    }),
    [players, loading, error, getServerPlayers, isPlayerOnline, refresh],
  );

  return (
    <PlayerDataContext.Provider value={value}>
      {children}
    </PlayerDataContext.Provider>
  );
}
