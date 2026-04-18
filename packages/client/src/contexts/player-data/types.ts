import type { PlayerData } from "@createrington/shared/socket";

export interface PlayerStats {
  total: number;
  byServer: Record<number, number>;
  averageSessionDuration: number; // in seconds
  recentJoins: number;
  recentLeaves: number;
}

export interface PlayerDataContextType {
  // State
  players: PlayerData[];
  playerMap: Map<string, PlayerData>;
  loading: boolean;
  error: Error | null;
  stats: PlayerStats;
  isSubscribed: boolean;
  recentJoins: PlayerData[];
  recentLeaves: PlayerData[];

  // Methods
  getPlayer: (uuid: string) => PlayerData | undefined;
  getPlayerByUsername: (username: string) => PlayerData | undefined;
  getAllPlayers: () => PlayerData[];
  getServerPlayers: (serverId: number) => PlayerData[];
  isPlayerOnline: (uuid: string) => boolean;
  getServerPlayerCount: (serverId: number) => number;
  refresh: () => Promise<void>;
  clearRecentEvents: () => void;
  subscribeToUpdates: () => Promise<void>;
  unsubscribeFromUpdates: () => Promise<void>;
}
