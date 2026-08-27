import config from "@/config";
import type { MessageCacheServiceConfig } from "./types";
import { Discord } from "@/discord/constants";

/**
 * Message cache service configuration
 *
 * Defines which channels to monitor for each Minecraft server
 */
export const MESSAGE_CACHE_CONFIG: MessageCacheServiceConfig = {
  servers: [
    {
      serverId: config.servers.rails.id,
      channelId: Discord.Channels.railsNSails.MINECRAFT_CHAT,
      maxMessages: 100,
    },
  ],
  loadHistoryOnStartup: true,
  botConfig: {
    createringtonBotId: config.discord.bots.main.id,
    createringtonWebhookId: config.discord.bots.main.webhook?.id,
  },
};
