import config from "@/config";
import type { ServerStatsConfig } from "./types";
import { Discord } from "@/discord/constants";

export const SERVER_STATS_CONFIG: ServerStatsConfig = {
  guildId: config.discord.guild.id,
  botsChannelId: Discord.Channels.serverStats.BOTS,
  membersChannelId: Discord.Channels.serverStats.MEMBERS,
  totalMembersChannelId: Discord.Channels.serverStats.ALL_MEMBERS,
  botCount: 3,
  refreshIntervalMs: 60 * 60 * 1000,
};
