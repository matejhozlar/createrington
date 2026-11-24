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
  roleMention,
} from "discord.js";

export const eventName: EventModule<"guildMemberRemove">["eventName"] =
  "guildMemberRemove";

export const prodOnly = true;

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
      content: `${roleMention(Discord.Roles.ADMIN)} 👋 Member left`,
      allowedMentions: { roles: [Discord.Roles.ADMIN] },
    });

    await Q.discord.guild.member.leave.update(
      { id: leftEntry.id },
      { notificationMessageId: message.id },
    );

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
