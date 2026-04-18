export interface AdminPlayerContextType {
  getServerName: (serverId: number) => string;
  isPlayerOnline: (minecraftUuid: string) => boolean;
  getPlayerServerId: (minecraftUuid: string) => number | null;
}
