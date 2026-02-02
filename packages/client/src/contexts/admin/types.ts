import {
  AdminPlayerStats,
  GetAdminPlayersQuery,
  GetAdminPlayersResponse,
} from "@createrington/shared/api";

export interface AdminPlayerContextType {
  // State
  stats: AdminPlayerStats | null;
  loading: boolean;
  error: Error | null;

  // Methods
  refreshStats: () => Promise<void>;
  fetchPlayers: (
    query?: GetAdminPlayersQuery,
  ) => Promise<GetAdminPlayersResponse | null>;

  // Helper methods
  getServerName: (serverId: number) => string;
  isPlayerOnline: (minecraftUuid: string) => boolean;
  getPlayerServerId: (minecraftUuid: string) => number | null;
}
