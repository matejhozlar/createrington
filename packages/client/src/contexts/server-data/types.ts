import type { ServerStatus } from "@createrington/shared/socket";

export interface ServerStats {
  total: number;
  online: number;
  totalPlayers: number;
  totalCapacity: number;
}

export interface ServerDataContextType {
  servers: ServerStatus[];
  loading: boolean;
  error: Error | null;
  stats: ServerStats;
  getServer: (serverId: number) => ServerStatus | undefined;
}
