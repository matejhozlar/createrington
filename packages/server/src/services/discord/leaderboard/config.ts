import config from "@/config";
import { type LeaderboardConfig, LeaderboardType } from "./types";
import { Q } from "@/db";
import { formatPlaytime } from "@/utils/format";
import { Discord } from "@/discord/constants";

/**
 * Configuration registry for all leaderboard types
 *
 * Each leaderboard type must be defined here with:
 * - Display properties (title, description, emoji)
 * - Target channel and server IDs
 * - Data fetching logic
 * - Value formatting function
 *
 * Add new leaderboard types by adding entries to this record.
 */
export const LEADERBOARD_CONFIGS: Record<LeaderboardType, LeaderboardConfig> = {
  [LeaderboardType.PLAYTIME]: {
    type: LeaderboardType.PLAYTIME,
    title: "Top Players by Playtime",
    description: "Players with the most time on the server",
    emoji: "",
    channelId: Discord.Channels.general.LEADERBOARDS,
    serverId: config.servers.cogs.id,
    /**
     * Fetches playtime leaderboard data from the database
     *
     * @param serverId - The Minecraft server ID to fetch data for
     * @param limit - Maximum number of entries to return
     * @returns Promise resolving to array of leaderboard entries
     */
    fetchData: async (serverId: number, limit: number) => {
      const leaderboard = await Q.player.playtime.summary.getLeaderboard(
        serverId,
        limit,
      );

      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        playerName: entry.minecraftUsername,
        value: entry.totalSeconds.toString(),
        formattedValue: formatPlaytime(Number(entry.totalSeconds)),
      }));
    },
    formatValue: formatPlaytime,
  },
};

/**
 * Retrieves the configuration for a specific leaderboard type
 *
 * @param type - The leaderboard type to get configuration for
 * @returns The leaderboard configuration object
 * @throws Error if no configuration exists for the given type
 */
export function getLeaderboardConfig(type: LeaderboardType): LeaderboardConfig {
  const config = LEADERBOARD_CONFIGS[type];
  if (!config) {
    throw new Error(`No configuration found for leaderboard type: ${type}`);
  }
  return config;
}

/**
 * Gets all available leaderboard types
 *
 * @returns Array of all registered leaderboard types
 */
export function getAllLeaderboardTypes(): LeaderboardType[] {
  return Object.keys(LEADERBOARD_CONFIGS) as LeaderboardType[];
}

/**
 * Type guard to check if a string is a valid leaderboard type
 *
 * @param type - The string to check
 * @returns True if the string is a registered leaderboard type
 */
export function isValidLeaderboardType(type: string): type is LeaderboardType {
  return type in LEADERBOARD_CONFIGS;
}
