import config from "@/config";

/** Per-server configuration for SFTP-based stats import */
export interface StatsImportServerConfig {
  serverId: number;
  serverName: string;
  sftp: {
    host: string;
    port: number;
    username: string;
    password: string;
    /** Remote path to the Minecraft stats directory (contains <uuid>.json files) */
    statsPath: string;
  };
}

/** List of all Minecraft servers configured for stats import */
export const STATS_IMPORT_SERVERS: StatsImportServerConfig[] = [
  {
    serverId: config.servers.rails.id,
    serverName: config.servers.rails.name,
    sftp: config.servers.rails.sftp,
  },
];
