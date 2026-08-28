import config from "@/config";
import { type LeaderboardConfig, LeaderboardType } from "./types";
import { Q } from "@/db";
import {
  formatPlaytime,
  formatBalance,
  discordTimestamp,
} from "@/utils/format";
import { Discord } from "@/discord/constants";
import { rankNetWorth } from "./networth";

const TITLE_IMAGE_BASE = "https://assets.createrington.com/titles";

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
    titleImageUrl: `${TITLE_IMAGE_BASE}/playtime.png`,
    channelId: Discord.Channels.general.LEADERBOARDS,
    serverId: config.servers.rails.id,
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

      return leaderboard.map((entry, index) => {
        const sessions = entry.totalSessions === 1 ? "session" : "sessions";
        const parts = [`${entry.totalSessions} ${sessions}`];
        if (entry.lastSeen) {
          parts.push(`last seen ${discordTimestamp(entry.lastSeen, "R")}`);
        }

        return {
          rank: index + 1,
          playerName: entry.minecraftUsername,
          playerUuid: entry.playerMinecraftUuid,
          value: entry.totalSeconds.toString(),
          formattedValue: formatPlaytime(Number(entry.totalSeconds)),
          subtitle: parts.join(" • "),
        };
      });
    },
    formatValue: formatPlaytime,
  },
  [LeaderboardType.NET_WORTH]: {
    type: LeaderboardType.NET_WORTH,
    title: "Top Players by Net Worth",
    description: "Players with the highest in-game balance",
    emoji: "💰",
    titleImageUrl: `${TITLE_IMAGE_BASE}/net-worth.png`,
    channelId: Discord.Channels.general.LEADERBOARDS,
    fetchData: async (_serverId: number, limit: number) => {
      const [balances, players] = await Promise.all([
        Q.player.balance.getAllBalances(),
        Q.player.getAll(),
      ]);

      const nameMap = new Map(
        players.map((p) => [
          p.minecraftUuid,
          p.minecraftUsername ?? p.minecraftUuid,
        ]),
      );

      return rankNetWorth(balances, nameMap, limit);
    },
    formatValue: (value: number) => formatBalance(value),
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
