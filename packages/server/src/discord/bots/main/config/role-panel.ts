import { Discord } from "@/discord/constants";

export const ROLE_PANEL_BUTTON_PREFIX = "role-panel";
export const ROLE_PANEL_MAX_ROLES = 10;

export interface RolePanelPresetRole {
  roleId: string;
  label: string;
  description: string;
  emoji: string;
}

export interface RolePanelPreset {
  id: string;
  label: string;
  title: string;
  description: string;
  roles: RolePanelPresetRole[];
}

export const ROLE_PANEL_PRESETS: RolePanelPreset[] = [
  {
    id: "notifications",
    label: "Notifications",
    title: "🔔 Notification Preferences",
    description:
      "Choose which notifications you'd like to receive. Click the buttons below to toggle notifications on or off.\n\n" +
      "**How it works:**\n" +
      "- Click a button to **enable** notifications (get pinged)\n" +
      "- Click again to **disable** notifications (stop pings)\n\n" +
      "**Available Notifications:**",
    roles: [
      {
        roleId: Discord.Roles.RAILSNSAILSNOTIFICATIONS,
        label: "Rails 'n Sails",
        description: "Get pinged for train crashes and other server events",
        emoji: "🚂",
      },
      {
        roleId: Discord.Roles.UPDATE,
        label: "Modpack Updates",
        description: "Get pinged when a new modpack changelog is posted",
        emoji: "📦",
      },
    ],
  },
  {
    id: "testing",
    label: "Testing",
    title: "🧪 Public Testing",
    description:
      "Want to try upcoming changes before they go live? Click the button below to get access to the public testing forum, and click it again to leave.",
    roles: [
      {
        roleId: Discord.Roles.TESTER,
        label: "Tester",
        description: "Get access to the public testing forum",
        emoji: "🧪",
      },
    ],
  },
];

export function getRolePanelPreset(id: string): RolePanelPreset | undefined {
  return ROLE_PANEL_PRESETS.find((preset) => preset.id === id);
}

export function isPresetRole(roleId: string): boolean {
  return ROLE_PANEL_PRESETS.some((preset) =>
    preset.roles.some((role) => role.roleId === roleId),
  );
}
