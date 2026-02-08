export interface AdminPlayerContextType {
  // Helper methods (from WebSocket data)
  getServerName: (serverId: number) => string;
  isPlayerOnline: (minecraftUuid: string) => boolean;
  getPlayerServerId: (minecraftUuid: string) => number | null;
}
