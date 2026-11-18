import { Discord } from "@/discord/constants";

export interface NotificationConfig {
  id: string;
  label: string;
  description: string;
  roleId: string;
  emoji: string;
  enabled: boolean;
}

export const NOTIFICATION_CONFIGS: NotificationConfig[] = [
  {
    id: "rails-n-sails-notifications",
    label: "Rails 'n Sails",
    description: "Get pinged for train crashes and other server events",
    roleId: Discord.Roles.RAILSNSAILSNOTIFICATIONS,
    emoji: "🚂",
    enabled: true,
  },
  {
    id: "modpack-updates",
    label: "Modpack Updates",
    description: "Get pinged when a new modpack changelog is posted",
    roleId: Discord.Roles.UPDATE,
    emoji: "📦",
    enabled: true,
  },
];

export function getEnabledNotifications(): NotificationConfig[] {
  return NOTIFICATION_CONFIGS.filter((n) => n.enabled);
}

export function getNotificationConfig(
  id: string,
): NotificationConfig | undefined {
  return NOTIFICATION_CONFIGS.find((n) => n.id === id);
}
