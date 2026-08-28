import {
  getNotificationConfig,
  type RoleAssignmentNotification,
  RoleConditionType,
} from "@/services/discord/role";
import { createEmbed } from "../../embed-builder";
import { EmbedColors } from "../../colors";
import { Discord } from "@/discord/constants";
import { formatBalance, formatDaysCount, formatPlaytime } from "@/utils/format";

/**
 * Formats a value based on condition type
 *
 * @param value - The value to format
 * @param conditionType - The type of condition
 * @returns Formatted string
 */
function formatValue(value: number, conditionType: RoleConditionType): string {
  switch (conditionType) {
    case RoleConditionType.PLAYTIME:
    case RoleConditionType.TOP_PLAYTIME:
      return formatPlaytime(value);
    case RoleConditionType.BALANCE:
    case RoleConditionType.TOP_BALANCE:
      return `${formatBalance(value)}`;
    case RoleConditionType.SERVER_AGE:
      return `${formatDaysCount(value)} ${value > 0 ? "ago" : ""}`;
    default:
      return value.toString();
  }
}

/**
 * Gets a congratulatory message based on whether it's a milestone
 *
 * @param isMilestone - Whether this is milestone role
 * @returns Congratulatory message
 */
function getCongratulatoryMessage(isMilestone: boolean): string {
  if (isMilestone) {
    const messages = [
      "has achieved an incredible milestone! 🎉",
      "has reached new heights! 🌟",
      "has ascended to greatness! ✨",
      "has proven their mastery! 🏆",
      "has earned a legendary achievement! 👑",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  const messages = [
    "has ranked up! 🎊",
    "has advanced! ⬆️",
    "has progressed! 📈",
    "has leveled up! ⭐",
    "has earned a new title! 🎯",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export const RoleAssignmentEmbedPresets = {
  /**
   * Creates an embed for a role assignment notification
   *
   * @param notification - Role assignment notification data
   * @returns Discord embed builder
   */
  rankUp(notification: RoleAssignmentNotification) {
    const config = getNotificationConfig(notification.role.roleId);
    const isMilestone = config.isMilestone || false;
    const emoji = config.emoji || "🎖️";

    const congratsMessage =
      config.customMessage || getCongratulatoryMessage(isMilestone);

    const embed = createEmbed()
      .title(`${emoji} Rank Up!`)
      .color(isMilestone ? EmbedColors.Premium : EmbedColors.Success)
      .description(
        `${Discord.Users.mention(
          notification.discordId,
        )} ${congratsMessage}\n\n` + `**${notification.role.label}**`,
      );

    if (
      notification.role.conditionType === RoleConditionType.PLAYTIME ||
      notification.role.conditionType === RoleConditionType.TOP_PLAYTIME
    ) {
      embed.field(
        "Total Playtime",
        formatValue(notification.currentValue, notification.role.conditionType),
        true,
      );
    } else if (
      notification.role.conditionType === RoleConditionType.BALANCE ||
      notification.role.conditionType === RoleConditionType.TOP_BALANCE
    ) {
      embed.field(
        "Current Balance",
        formatValue(notification.currentValue, notification.role.conditionType),
        true,
      );
    } else if (
      notification.role.conditionType === RoleConditionType.SERVER_AGE
    ) {
      embed.field(
        "Member Since",
        formatValue(notification.currentValue, notification.role.conditionType),
      );
    }

    embed.timestamp();

    return embed;
  },

  /**
   * Creates a simple notification embed for multiple role changes
   *
   * @param notifications - Array of role assignment notifications
   * @returns Discord embed builder
   */
  multipleRankUps(notifications: RoleAssignmentNotification[]) {
    const firstNotification = notifications[0];
    const embed = createEmbed()
      .title("🎉 Multiple Rank Ups!")
      .color(EmbedColors.Success)
      .description(
        `${Discord.Users.mention(
          firstNotification.discordId,
        )} has earned multiple new roles!`,
      );

    const rolesList = notifications
      .map((n) => {
        const config = getNotificationConfig(n.role.roleId);
        const emoji = config.emoji || "🎖️";
        return `${emoji} **${n.role.label}**`;
      })
      .join("\n");

    embed.field("New Roles", rolesList, false);

    embed.timestamp();

    return embed;
  },
};
