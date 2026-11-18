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
    serverId: config.servers.rails.id,
    serverName: config.servers.rails.name,
    sftp: config.servers.rails.sftp,
  },
];
