import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";
import { getServerConfig } from "../../config/server-selection";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";

export const pattern = "server-select:*";

function parseCustomId(customId: string): { serverId: string } | null {
  const [, serverId] = customId.split(":");
  if (!serverId) return null;
  return { serverId };
}

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "❌ Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { serverId: id } = parsed;
  const serverId = parseInt(id);
  const serverConfig = getServerConfig(serverId);

  if (!serverConfig) {
    await interaction.reply({
      content: "❌ Server configuration not found",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!serverConfig.enabled) {
    await interaction.reply({
      content: `❌ **${serverConfig.label}** is not currently available`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member as GuildMember;

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    await interaction.reply({
      content: "❌ Could not verify your roles. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasRole = RoleManager.has(member, serverConfig.roleId);

  try {
    if (hasRole) {
      const removed = await RoleManager.remove(
        member,
        serverConfig.roleId,
        `User left ${serverConfig.label} server`,
      );

      if (!removed) {
        throw new Error("Failed to remove role");
      }

      await replyError(
        interaction,
        "Server Access Removed",
        `You no longer have access to **${serverConfig.label}** channels.\n\n` +
          `Click the button again to rejoin.`,
      );

      logger.info(
        `${member.user.tag} removed access to ${serverConfig.label} (${serverId})`,
      );
    } else {
      const added = await RoleManager.assign(
        member,
        serverConfig.roleId,
        `User Joined ${serverConfig.label} server`,
      );

      if (!added) {
        throw new Error("Failed to assign role");
      }

      const embed = EmbedPresets.success(
        "Server Access Granted",
        `You now have access to **${serverConfig.label}** channels!`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${member.user.tag} gained access to ${serverConfig.label} (${serverId})`,
      );
    }
  } catch (error) {
    logger.error(`Failed to toggle server role for ${member.user.tag}:`, error);

    await replyError(
      interaction,
      "Action Failed",
      "Something went wrong while updating your roles. Please try again or contact an administrator.",
    );
  }
}
