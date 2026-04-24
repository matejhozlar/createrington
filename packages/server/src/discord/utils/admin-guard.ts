import {
  type ChatInputCommandInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";
import { EmbedPresets } from "../embeds";
import { isAdminDb } from "@/db/utils";
import { RoleManager } from "./roles/role-manager";
import { Discord } from "../constants";

/**
 * Resolves a GuildMember from an interaction's member field
 *
 * @returns The GuildMember, or null if unavailable or not a proper GuildMember
 */
function resolveGuildMember(
  interaction: ChatInputCommandInteraction,
): GuildMember | null {
  const member = interaction.member as GuildMember | null;

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    return null;
  }

  return member;
}

/**
 * Checks if a guild member is an admin by verifying either:
 * - Has the ADMIN role in Discord, OR
 * - Is registered as admin in the database
 *
 * @param member - The Discord guild member
 * @returns True if admin by either Discord role or database
 */
export async function isAdmin(member: GuildMember): Promise<boolean> {
  if (RoleManager.has(member, Discord.Roles.ADMIN)) return true;

  return await isAdminDb(member.id);
}

/**
 * Checks if the user is an admin
 * Replies with error if not and returns false
 *
 * @param interaction - The command interaction
 * @returns True if admin, false otherwise
 */
export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = resolveGuildMember(interaction);

  if (!member || !(await isAdmin(member))) {
    const embed = EmbedPresets.error(
      "Permission denied",
      "This command requires administrator privileges",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

/**
 * Checks if the user is owner
 * Replies with error if not and returns false
 *
 * @param interaction - The command interaction
 * @returns True if owner, false otherwise
 */
export async function requireOwner(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = resolveGuildMember(interaction);

  if (!member || !RoleManager.has(member, Discord.Roles.OWNER)) {
    const embed = EmbedPresets.error(
      "Permission denied",
      "This command is owner-only",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

/**
 * Throws an error if user is not an admin
 * Used for error handling to catch it
 *
 * @param interaction - The command interaction
 * @throws Error if user is not an admin
 */
export async function assertAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const member = resolveGuildMember(interaction);

  if (!member || !(await isAdmin(member))) {
    throw new Error("User is not an admin");
  }
}
