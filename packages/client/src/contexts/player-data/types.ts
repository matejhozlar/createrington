import type { PlayerData } from "@createrington/shared/socket";

export type OnlinePlayer = Omit<PlayerData, "sessionStart"> & {
  sessionStart: Date;
};

export interface PlayerDataContextType {
  players: OnlinePlayer[];
  loading: boolean;
  error: Error | null;
  getServerPlayers: (serverId: number) => OnlinePlayer[];
  isPlayerOnline: (uuid: string) => boolean;
  refresh: () => Promise<void>;
}
