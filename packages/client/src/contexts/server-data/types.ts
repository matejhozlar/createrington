import type { ServerStatus } from "@createrington/shared/socket";

export interface ServerStats {
  total: number;
  online: number;
  offline: number;
  totalPlayers: number;
  totalCapacity: number;
  averageLoad: number;
}

export interface ServerDataContextType {
  // State
  servers: ServerStatus[];
  serverMap: Map<number, ServerStatus>;
  loading: boolean;
  error: Error | null;
  stats: ServerStats;
  isSubscribed: boolean;

  // Methods
  getServer: (serverId: number) => ServerStatus | undefined;
  getAllServers: () => ServerStatus[];
  getOnlineServers: () => ServerStatus[];
  getOfflineServers: () => ServerStatus[];
  isServerOnline: (serverId: number) => boolean;
  refresh: () => Promise<void>;
  subscribeToUpdates: () => Promise<void>;
  unsubscribeFromUpdates: () => Promise<void>;
}
