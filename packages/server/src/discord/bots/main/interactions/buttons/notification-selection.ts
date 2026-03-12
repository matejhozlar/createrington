import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";
import { getNotificationConfig } from "../../config/notification-selection";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { EmbedPresets } from "@/discord/embeds";

/**
 * Handles notification selection buttons
 * Pattern: notification-select:*
 */
export const pattern = "notification-select:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

/**
 * Parses the notification selection button customId (format: notification-select:notificationId)
 */
function parseCustomId(customId: string): { notificationId: string } | null {
  const [, notificationId] = customId.split(":");
  if (!notificationId) return null;
  return { notificationId };
}

/**
 * Main execution handler for notification selection button interactions
 *
 * Workflow:
 * 1. Parse notification ID from button customId
 * 2. Get notification configuration
 * 3. Check if user already has the role
 * 4. Toggle role (add if missing, remove if present)
 * 5. Send confirmation message
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

  const notificationConfig = getNotificationConfig(parsed.notificationId);

  if (!notificationConfig) {
    await interaction.reply({
      content: "❌ Notification configuration not found",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!notificationConfig.enabled) {
    await interaction.reply({
      content: `❌ **${notificationConfig.label}** notifications are not currently available`,
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

  const hasRole = RoleManager.has(member, notificationConfig.roleId);

  try {
    if (hasRole) {
      const removed = await RoleManager.remove(
        member,
        notificationConfig.roleId,
        `User disabled ${notificationConfig.label} notifications`,
      );

      if (!removed) {
        throw new Error("Failed to remove role");
      }

      const embed = EmbedPresets.success(
        "Notifications Disabled",
        `You will no longer be pinged for **${notificationConfig.label}** notifications.\n\n` +
          `Click the button again to re-enable.`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${member.user.tag} disabled ${notificationConfig.label} notifications`,
      );
    } else {
      const added = await RoleManager.assign(
        member,
        notificationConfig.roleId,
        `User enabled ${notificationConfig.label} notifications`,
      );

      if (!added) {
        throw new Error("Failed to assign role");
      }

      const embed = EmbedPresets.success(
        "Notifications Enabled",
        `You will now be pinged for **${notificationConfig.label}** notifications!`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${member.user.tag} enabled ${notificationConfig.label} notifications`,
      );
    }
  } catch (error) {
    logger.error(
      `Failed to toggle notification role for ${member.user.tag}:`,
      error,
    );

    const embed = EmbedPresets.error(
      "Action Failed",
      "Something went wrong while updating your roles. Please try again or contact an administrator.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
