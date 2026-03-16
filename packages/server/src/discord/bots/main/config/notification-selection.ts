import { Discord } from "@/discord/constants";

/**
 * Notification configuration for role assignment
 */
export interface NotificationConfig {
  /** Unique identifier for this notification type */
  id: string;
  /** Display name for the notification */
  label: string;
  /** Description of what the notification covers */
  description: string;
  /** Discord role ID to assign */
  roleId: string;
  /** Emoji to display on button */
  emoji: string;
  /** Whether this notification is currently active */
  enabled: boolean;
}

/**
 * Notification selection configuration
 */
export const NOTIFICATION_CONFIGS: NotificationConfig[] = [
  {
    id: "cogs-and-steam-notifications",
    label: "Cogs & Steam",
    description: "Get pinged for train crashes and other server events",
    roleId: Discord.Roles.COGS_AND_STEAMNOTIFICATIONS,
    emoji: "🚂",
    enabled: true,
  },
  {
    id: "crypto-notifications",
    label: "Crypto",
    description:
      "Get pinged for market events, token launches, and price alerts",
    roleId: Discord.Roles.CRYPTONOTIFICATIONS,
    emoji: "💰",
    enabled: true,
  },
];

/**
 * Gets all enabled notification configurations
 */
export function getEnabledNotifications(): NotificationConfig[] {
  return NOTIFICATION_CONFIGS.filter((n) => n.enabled);
}

/**
 * Gets a notification config by its ID
 */
export function getNotificationConfig(
  id: string,
): NotificationConfig | undefined {
  return NOTIFICATION_CONFIGS.find((n) => n.id === id);
}
