import { EmbedPresets } from "@/discord/embeds";
import { getNotificationConfig } from "./config";
import type { RoleAssignmentNotification } from "./types";
import { Discord } from "@/discord/constants";

/**
 * Service for sending role assignment notifications
 *
 * Handles sending celebration messages to the Hall of Fame channel
 * when players earn new roles
 */
export class RoleNotificationService {
  /**
   * Sends a notification for a single role assignment
   *
   * @param notification - Role assignment notification data
   * @returns Promise resolving when notification is sent
   */
  async sendNotification(
    notification: RoleAssignmentNotification,
  ): Promise<void> {
    const config = getNotificationConfig(notification.role.roleId);

    if (!config.enabled) {
      logger.debug(
        `Notifications disabled for role ${notification.role.label}`,
      );
      return;
    }

    const channelId = config.channelId;
    if (!channelId) {
      logger.warn(
        `No channel ID configured for role notification (${notification.role.label})`,
      );
      return;
    }

    try {
      const embed = EmbedPresets.roleAssignment.rankUp(notification);

      const result = await Discord.Messages.send({
        channelId,
        embeds: embed.build(),
      });

      if (result.success) {
        logger.info(
          `Sent role notification for ${notification.username} -> ${notification.role.label}`,
        );
      } else {
        logger.error(`Failed to send role notification: ${result.error}`);
      }
    } catch (error) {
      logger.error("Failed to send role notification:", error);
    }
  }

  /**
   * Sends a notification for multiple role assignments at once
   *
   * Used when a player earns multiple roles simultaneously
   *
   * @param notifications - Array of role assignment notifications
   * @returns Promise resolving when notification is sent
   */
  async sendMultipleNotifications(
    notifications: RoleAssignmentNotification[],
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    const anyEnabled = notifications.some((n) => {
      const config = getNotificationConfig(n.role.roleId);
      return config.enabled;
    });

    if (!anyEnabled) {
      return;
    }

    const firstConfig = getNotificationConfig(notifications[0].role.roleId);
    const channelId = firstConfig.channelId;

    if (!channelId) {
      logger.warn("No channel ID configured for role notifications");
      return;
    }

    try {
      const embed = EmbedPresets.roleAssignment.multipleRankUps(notifications);

      const result = await Discord.Messages.send({
        channelId,
        embeds: embed.build(),
      });

      if (result.success) {
        logger.info(
          `Sent multiple role notifications for ${notifications[0].username}`,
        );
      } else {
        logger.error(
          `Failed to send multiple role notifications: ${result.error}`,
        );
      }
    } catch (error) {
      logger.error("Failed to send multiple role notifications:", error);
    }
  }
}

export const roleNotificationService = new RoleNotificationService();
