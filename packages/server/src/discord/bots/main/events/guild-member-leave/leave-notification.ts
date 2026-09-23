import { Q } from "@/db";
import { waitlistService } from "@/services/waitlist/waitlist.service";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type Client,
  type GuildMember,
  type PartialGuildMember,
} from "discord.js";

/**
 * Guild member remove event handler
 *
 * Handles a member leaving the Discord server:
 * 1. Expires any live waitlist entry and deletes its verification channel
 * 2. Checks if the departed member is registered in the system
 * 3. Records their departure in departed_member table
 * 4. Sends admin notification with option to immediately delete
 * 5. Schedules automatic deletion after 30 days if no action taken
 */
export const eventName: EventModule<"guildMemberRemove">["eventName"] =
  "guildMemberRemove";

/**
 * Whether this event should only be registered in production
 */
export const prodOnly = true;

/**
 * Executes when a member leaves the guild
 *
 * @param client - The Discord client instance
 * @param member - The guild member who left
 */
export async function execute(
  client: Client,
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  try {
    await waitlistService.expireForDeparture(member.user.id);
  } catch (error) {
    logger.error(
      `Failed to expire waitlist entry for departing ${member.user.tag}:`,
      error,
    );
  }

  try {
    const player = await Q.player.find({ discordId: member.user.id });

    if (!player) {
      logger.debug(
        `Member ${member.user.tag} left but was not registered - no action needed`,
      );
      return;
    }

    // If this departure was triggered by the inactivity cleanup flow,
    // the warning row is marked removed before the kick fires. Skip the
    // "member left" notification: the inactivity removal already sent
    // its own announcement, and the player record is about to be deleted
    // which would break the Yeet-from-database button.
    const removedWarnings = await Q.player.inactivity.warning.count({
      playerMinecraftUuid: player.minecraftUuid,
      removedAt: { $exists: true },
    });

    if (removedWarnings > 0) {
      logger.info(
        `Skipping leave notification for ${member.user.tag} (${player.minecraftUsername}): departure triggered by inactivity cleanup`,
      );
      return;
    }

    logger.info(
      `Registered member ${member.user.tag} (${player.minecraftUsername}) left the server`,
    );

    const leftEntry = await Q.discord.guild.member.leave.createAndReturn({
      discordId: member.user.id,
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    });

    logger.info("Departed entry:", leftEntry);

    const embed = EmbedPresets.departed.departedMember({
      discordId: member.user.id,
      discordTag: member.user.tag,
      minecraftUsername: player.minecraftUsername,
      minecraftUuid: player.minecraftUuid,
      departedAt: new Date(),
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.departedMember.deleteNow(leftEntry.id),
      ButtonPresets.links.adminPanel(),
    );

    const message = await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.build(),
      components: [actionRow],
      content: `${Discord.Roles.mention(Discord.Roles.ADMIN)} 👋 Member left`,
    });

    if (message) {
      await Q.discord.guild.member.leave.update(
        { id: leftEntry.id },
        { notificationMessageId: message.messageId },
      );
    }

    logger.info(
      `Sent departure notification for ${player.minecraftUsername} (auto-delete in 30 days)`,
    );
  } catch (error) {
    logger.error(
      `Failed to handle guild member remove for ${member.user.tag}`,
      error,
    );
  }
}
