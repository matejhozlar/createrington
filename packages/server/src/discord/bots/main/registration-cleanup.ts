import {
  ChannelType,
  type Client,
  type GuildTextBasedChannel,
  OverwriteType,
} from "discord.js";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import config from "@/config";

/** Duration before a completed registration channel is auto-deleted (ms) */
export const AUTO_CLOSE_MS = 24 * 60 * 60 * 1000;

/**
 * Schedules a registration channel for deletion.
 * If `delayMs <= 0` the channel is deleted immediately (with a short grace period
 * so the deletion embed is visible).
 */
export function scheduleChannelClose(
  channel: GuildTextBasedChannel,
  delayMs: number,
  reason: string,
): void {
  const effectiveDelay = Math.max(delayMs, 0);

  setTimeout(async () => {
    try {
      const deleteEmbed = EmbedPresets.channelDeletion();
      await channel.send({ embeds: [deleteEmbed.build()] });
    } catch {
      // Channel may already be gone — proceed to delete
    }

    setTimeout(async () => {
      try {
        await channel.delete(reason);
        logger.info(`Deleted registration channel ${channel.id} — ${reason}`);
      } catch (error) {
        logger.error(
          `Failed to delete registration channel ${channel.id}:`,
          error,
        );
      }
    }, 5000);
  }, effectiveDelay);
}

/**
 * Scans every channel in the VERIFICATION category and deletes any that
 * belong to a user who already has the VERIFIED role — meaning they
 * completed registration but the channel was never closed (e.g. bot restart).
 *
 * Channel ownership is determined by the member-type permission overwrite
 * set when the channel was created.
 *
 * Call once after the main bot is ready.
 */
export async function sweepRegistrationChannels(bot: Client): Promise<void> {
  const guild = bot.guilds.cache.get(config.discord.guild.id);
  if (!guild) {
    logger.warn("Registration sweep: guild not found in cache");
    return;
  }

  const categoryId = Discord.Categories.VERIFICATION;
  const channels = guild.channels.cache.filter(
    (ch) => ch.parentId === categoryId && ch.type === ChannelType.GuildText,
  );

  if (channels.size === 0) return;

  let cleaned = 0;

  for (const [, channel] of channels) {
    if (channel.type !== ChannelType.GuildText) continue;

    // Find the member this channel belongs to via the permission overwrites
    const memberOverwrite = channel.permissionOverwrites.cache.find(
      (ow) => ow.type === OverwriteType.Member,
    );
    if (!memberOverwrite) continue;

    try {
      const member = await guild.members.fetch(memberOverwrite.id);
      const isVerified = member.roles.cache.has(Discord.Roles.VERIFIED);

      if (isVerified) {
        scheduleChannelClose(
          channel as GuildTextBasedChannel,
          0,
          `Registration completed - auto-closed on startup (${member.user.tag})`,
        );
        cleaned++;
      }
    } catch {
      // Member may have left the server — clean up the orphaned channel
      scheduleChannelClose(
        channel as GuildTextBasedChannel,
        0,
        "Registration channel cleanup - member no longer in server",
      );
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(
      `Registration sweep: scheduled ${cleaned} channel(s) for deletion`,
    );
  }
}
