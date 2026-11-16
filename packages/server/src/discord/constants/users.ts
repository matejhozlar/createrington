import { getService, Services } from "@/services";
import type { User } from "discord.js";

export const DiscordUsers = {
  async fetch(discordId: string): Promise<User | null> {
    try {
      const client = await getService(Services.DISCORD_MAIN_BOT);
      return await client.users.fetch(discordId);
    } catch (error) {
      logger.error(`Failed to fetch user ${discordId}:`, error);
      return null;
    }
  },

  mention(discordId: string): string {
    return `<@${discordId}>`;
  },
};
