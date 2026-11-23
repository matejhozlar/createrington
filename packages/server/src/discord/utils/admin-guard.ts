import { type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { replyError } from "@/discord/utils/interaction-reply";
import { isAdminDb } from "@/db/utils/admin";
import { RoleManager } from "./roles/role-manager";
import { Discord } from "../constants";

function resolveGuildMember(
  interaction: ChatInputCommandInteraction,
): GuildMember | null {
  return interaction.inCachedGuild() ? interaction.member : null;
}

export async function isAdmin(member: GuildMember): Promise<boolean> {
  if (RoleManager.has(member, Discord.Roles.ADMIN)) return true;

  return await isAdminDb(member.id);
}

export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = resolveGuildMember(interaction);

  if (!member || !(await isAdmin(member))) {
    await replyError(
      interaction,
      "Permission denied",
      "This command requires administrator privileges",
    );
    return false;
  }

  return true;
}

export async function requireOwner(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const member = resolveGuildMember(interaction);

  if (!member || !RoleManager.has(member, Discord.Roles.OWNER)) {
    await replyError(
      interaction,
      "Permission denied",
      "This command is owner-only",
    );
    return false;
  }

  return true;
}
