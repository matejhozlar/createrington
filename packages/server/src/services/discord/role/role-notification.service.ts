import { AttachmentBuilder } from "discord.js";
import type { KnownPose } from "createrington-skin-api";
import { Q } from "@/db";
import { buildComponentsMessage, ComponentPresets } from "@/discord/components";
import type { RankUpMetric } from "@/discord/components/presets/hall-of-fame";
import { Discord } from "@/discord/constants";
import { squarePoseThumbnail } from "@/discord/utils/pose-thumbnail";
import { getSkinApiClient } from "@/services/skin-api";
import { getNotificationConfig } from "./config";
import { RoleConditionType, type RoleAssignmentNotification } from "./types";

const POSE_FILE_NAME = "rank-up.png";
const POSE_RENDER = { width: 512, height: 768 } as const;
const MC_HEADS_AVATAR_URL = "https://mc-heads.net/avatar";

interface PoseFigure {
  poseUrl?: string;
  files?: AttachmentBuilder[];
}

function metricOf(notification: RoleAssignmentNotification): RankUpMetric {
  const value = notification.currentValue;

  switch (notification.role.conditionType) {
    case RoleConditionType.PLAYTIME:
    case RoleConditionType.TOP_PLAYTIME:
      return { kind: "playtime", seconds: value };
    case RoleConditionType.BALANCE:
    case RoleConditionType.TOP_BALANCE:
      return { kind: "balance", amount: value };
    case RoleConditionType.SERVER_AGE:
      return { kind: "membership", days: value };
  }
}

function isCompetitive(notification: RoleAssignmentNotification): boolean {
  return (
    notification.role.conditionType === RoleConditionType.TOP_PLAYTIME ||
    notification.role.conditionType === RoleConditionType.TOP_BALANCE
  );
}

/**
 * Sends Hall of Fame announcements when players earn new roles. Each role has
 * its own enabled/channel/pose config; a missing or disabled config silently
 * skips the send. The container is striped with the Discord role's own color,
 * or left stripeless when the role has none. The player's skin is rendered in
 * the role's pose and squared off so Discord's thumbnail crop keeps the whole
 * figure, then attached to the message; it falls back to the player's mc-heads
 * head when the render fails and to no figure at all for members without a
 * registered Minecraft account. Send failures are logged and swallowed
 * (notifications are fire-and-forget, never block role assignment).
 */
export class RoleNotificationService {
  /** Sends the rank-up announcement for a single role assignment, no-op if the role's notification config is disabled or missing a channel. */
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
      const player = await Q.player.find({ discordId: notification.discordId });
      const figure = player
        ? await this.renderFigure(player.minecraftUuid, config.pose)
        : {};

      const message = buildComponentsMessage(
        ComponentPresets.hallOfFame.rankUp({
          discordId: notification.discordId,
          playerName: player?.minecraftUsername ?? notification.username,
          roleLabel: notification.role.label,
          metric: metricOf(notification),
          ...(figure.poseUrl && { poseUrl: figure.poseUrl }),
          ...(notification.roleColor > 0 && {
            accentColor: notification.roleColor,
          }),
          competitive: isCompetitive(notification),
        }),
      );

      const result = await Discord.Messages.send({
        channelId,
        components: message.components,
        flags: message.flags,
        files: figure.files,
        allowedMentions: { users: [notification.discordId] },
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

  private async renderFigure(
    minecraftUuid: string,
    pose: KnownPose,
  ): Promise<PoseFigure> {
    try {
      const png = await getSkinApiClient().render({
        pose,
        source: { uuid: minecraftUuid },
        options: POSE_RENDER,
      });

      return {
        poseUrl: `attachment://${POSE_FILE_NAME}`,
        files: [
          new AttachmentBuilder(await squarePoseThumbnail(png), {
            name: POSE_FILE_NAME,
          }),
        ],
      };
    } catch (error) {
      logger.warn(
        `Skin-api render failed for pose "${pose}" (${minecraftUuid}), falling back to mc-heads:`,
        error,
      );
      return { poseUrl: `${MC_HEADS_AVATAR_URL}/${minecraftUuid}` };
    }
  }
}

export const roleNotificationService = new RoleNotificationService();
