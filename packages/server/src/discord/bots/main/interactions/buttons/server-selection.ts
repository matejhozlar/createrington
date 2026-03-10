import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";
import { getServerConfig } from "../../config/server-selection";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { EmbedPresets } from "@/discord/embeds";

/**
 * Handles server selection buttons
 * Pattern: server-select:*
 */
export const pattern = "server-select:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

/**
 * Parses the server selection button customId (format: server-select:serverId)
 *
 * @param customId - The button's customId string
 * @returns Parsed server ID, or null if invalid
 * @private
 */
function parseCustomId(customId: string): { serverId: string } | null {
  const [, serverId] = customId.split(":");
  if (!serverId) return null;
  return { serverId };
}

/**
 * Main execution handler for server selection button interactions
 *
 * Workflow:
 * 1. Parse server ID from button customId
 * 2. Get server configuration
 * 3. Check if user already has the role
 * 4. Toggle role (add if missing, remove if present)
 * 5. Send confirmation message
 *
 * @param interaction - The button interaction to handle
 */
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

      const embed = EmbedPresets.success(
        "Server Access Removed",
        `You no longer have access to **${serverConfig.label}** channels.\n\n` +
          `Click the button again to rejoin.`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

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

    const embed = EmbedPresets.error(
      "Action Failed",
      "Something went wrog while updating yur roles. Please try again or contact an administrator.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
