import config from "@/config";
import { Discord } from "@/discord/constants";

/**
 * Server configuration for role assignment
 */
export interface ServerConfig {
  /** Internal server ID */
  id: number;
  /** Display name for the server */
  label: string;
  /** Description of the server */
  description: string;
  /** Discord role ID to assign */
  roleId: string;
  /** Emoji to display on button */
  emoji: string;
  /** Whether this server is currently active */
  enabled: boolean;
}

/**
 * Server selection configuration
 */
export const SERVER_CONFIGS: ServerConfig[] = [
  {
    id: config.servers.cogs.id,
    label: "Cogs & Steam",
    description: "Create focused server on NeoForge 1.21.1",
    roleId: Discord.Roles.COGS_AND_STEAM,
    emoji: "⚙️",
    enabled: false,
  },
  {
    id: 99,
    label: "Tester",
    description: "Get access to the public testing forum",
    roleId: Discord.Roles.TESTER,
    emoji: "🧪",
    enabled: true,
  },
];

/**
 * Gets all enabled server configurations
 *
 * @returns Array of server configs where enabled is true
 */
export function getEnabledServers(): ServerConfig[] {
  return SERVER_CONFIGS.filter((server) => server.enabled);
}

/**
 * Gets a server config by its internal ID
 *
 * @param serverId - The internal server ID
 * @returns The matching server config, or undefined if not found
 */
export function getServerConfig(serverId: number): ServerConfig | undefined {
  return SERVER_CONFIGS.find((server) => server.id === serverId);
}

/**
 * Gets the Discord role ID for a server
 *
 * @param serverId - The internal server ID
 * @returns The Discord role ID, or undefined if not found
 */
export function getServerRoleId(serverId: number): string | undefined {
  return getServerConfig(serverId)?.roleId;
}
