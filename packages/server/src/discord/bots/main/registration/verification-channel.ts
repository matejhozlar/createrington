import type { GuildMember, OverwriteResolvable, TextChannel } from "discord.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { Discord } from "@/discord/constants";

const CATEGORY_ALERT_THRESHOLD = 45;

export async function createVerificationChannel(
  member: GuildMember,
  joinNumber: number,
): Promise<TextChannel> {
  const categoryId = Discord.Categories.VERIFICATION;

  const occupied = member.guild.channels.cache.filter(
    (ch) => ch.parentId === categoryId,
  ).size;

  if (occupied >= CATEGORY_ALERT_THRESHOLD) {
    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        content: `⚠️ The verification category holds ${occupied} channels and Discord caps categories at 50. Close stale channels or new members will stop getting one.`,
      });
    } catch (error) {
      logger.error("Failed to send verification-category alert:", error);
    }
  }

  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: member.guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands,
      ],
    },
    {
      id: Discord.Roles.ADMIN,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
    {
      id: Discord.Roles.OWNER,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  return await member.guild.channels.create({
    name: `verify-${joinNumber}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
    topic: `Verification channel for ${member.user.tag} (Join #${joinNumber})`,
  });
}
