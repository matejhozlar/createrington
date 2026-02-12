import config from "@/config";

export interface StatsImportServerConfig {
  serverId: number;
  serverName: string;
  sftp: {
    host: string;
    port: number;
    username: string;
    password: string;
    statsPath: string;
  };
}

export const STATS_IMPORT_SERVERS: StatsImportServerConfig[] = [
  {
    serverId: config.servers.cogs.id,
    serverName: config.servers.cogs.name,
    sftp: config.servers.cogs.sftp,
  },
];
