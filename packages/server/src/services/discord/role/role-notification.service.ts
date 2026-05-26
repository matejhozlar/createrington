import { EmbedPresets } from "@/discord/embeds";
import { getNotificationConfig } from "./config";
import type { RoleAssignmentNotification } from "./types";
import { Discord } from "@/discord/constants";

/**
 * Sends Hall of Fame celebration embeds when players earn new roles. Each role
 * has its own enabled/channel config; a missing or disabled config silently
 * skips the send. Send failures are logged and swallowed (notifications are
 * fire-and-forget, never block role assignment).
 */
export class RoleNotificationService {
  /** Sends the rank-up embed for a single role assignment, no-op if the role's notification config is disabled or missing a channel. */
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

  /** Sends a single combined embed for a batch of simultaneous rank-ups, using the channel of the first notification's role config. */
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
