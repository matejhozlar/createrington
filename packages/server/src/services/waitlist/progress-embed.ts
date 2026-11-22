import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { getService, Services } from "@/services";

async function fetchDiscordUser(discordId: string) {
  try {
    const client = await getService(Services.DISCORD_MAIN_BOT);
    return await client.users.fetch(discordId);
  } catch (error) {
    logger.warn(`Failed to fetch Discord user ${discordId}:`, error);
    return null;
  }
}

export async function updateProgressEmbed(entryId: number): Promise<void> {
  try {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    if (!entry.adminMessageId) {
      logger.debug(`No admin message ID for waitlist entry ${entryId}`);
      return;
    }

    const [discordUser, player] = await Promise.all([
      fetchDiscordUser(entry.discordId),
      Q.player.find({ discordId: entry.discordId }),
    ]);

    const progressEmbed = EmbedPresets.waitlist
      .createProgressEmbed(entry, discordUser, player)
      .timestamp();

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.links.adminPanel(),
    );

    await Discord.Messages.edit({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      messageId: entry.adminMessageId,
      embeds: progressEmbed.build(),
      components: [linkRow],
    });

    logger.debug(`Updated progress embed for entry ${entryId}`);
  } catch (error) {
    logger.error(
      `Failed to update progress embed for entry ${entryId}:`,
      error,
    );
  }
}

export async function markJoinedMinecraft(discordId: string): Promise<void> {
  const entry = await Q.waitlist.entry.find({ discordId });
  if (!entry || entry.joinedMinecraft) return;

  await Q.waitlist.entry.update({ id: entry.id }, { joinedMinecraft: true });

  await updateProgressEmbed(entry.id);
}
