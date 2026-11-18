import config from "@/config";

export interface ServerInfo {
  serverId: number;
  serverName: string;
  ip: string;
  port: number;
}

export const MINECRAFT_SERVER_MAPPING: Record<string, ServerInfo> = {
  [config.servers.rails.ip]: {
    serverId: config.servers.rails.id,
    serverName: config.servers.rails.name,
    ip: config.servers.rails.ip,
    port: config.servers.rails.port,
  },
};

export interface ServerConfig {
  id: number;
  name: string;
  slug: string;
  ip: string;
  port: number;
  maxPlayers: number;
}

export const MINECRAFT_SERVERS: Record<number, ServerConfig> = {
  [config.servers.rails.id]: {
    id: config.servers.rails.id,
    name: config.servers.rails.name,
    slug: config.servers.rails.slug,
    ip: config.servers.rails.ip,
    port: config.servers.rails.port,
    maxPlayers: 20,
  },
};

/**
 * Get server info by IP address
 */
export function getServerByIp(ip: string): ServerInfo | undefined {
  return MINECRAFT_SERVER_MAPPING[ip];
}

/**
 * Get server config by ID
 */
export function getServerById(serverId: number): ServerConfig | undefined {
  return MINECRAFT_SERVERS[serverId];
}

/**
 * Get all server IDs
 */
export function getAllServerIds(): number[] {
  return Object.keys(MINECRAFT_SERVERS).map(Number);
}

/**
 * Check if server ID exists
 */
export function isValidServerId(serverId: number): boolean {
  return serverId in MINECRAFT_SERVERS;
}
