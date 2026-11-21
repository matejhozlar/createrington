import type { GuildMember } from "discord.js";
import { getService, Services } from "@/services";

export async function fetchGuildMember(
  discordId: string,
): Promise<GuildMember | null> {
  const mainBot = await getService(Services.DISCORD_MAIN_BOT);
  const guild = mainBot.guilds.cache.first();
  if (!guild) return null;
  return guild.members.fetch(discordId).catch(() => null);
}
