import { type GuildMember, PermissionFlagsBits, type Role } from "discord.js";

export const ROLE_PANEL_BUTTON_PREFIX = "role-panel";
export const ROLE_PANEL_MAX_ROLES = 10;

const ELEVATED_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone,
];

export function getUnassignableReason(
  role: Role,
  me: GuildMember,
): string | null {
  if (role.id === role.guild.id) return "is the @everyone role";
  if (role.managed) return "is managed by an integration";
  if (role.permissions.any(ELEVATED_PERMISSIONS)) {
    return "grants moderation permissions";
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return "is above my highest role";
  }
  return null;
}
