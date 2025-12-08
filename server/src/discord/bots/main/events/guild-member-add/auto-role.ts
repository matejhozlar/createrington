import config from "@/config";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Client, GuildMember } from "discord.js";
import { EventModule } from "../../loaders/event-loader";

const autoRoleConfig = config.discord.events.onGuildMemberAdd.autoRole;

/**
 * Auto-role assignment event handler
 *
 * Automatically assigns the "Unverified" role
 * to new members when they join the guild
 */
export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

/**
 * Whether this event should only be registered in production
 */
export const prodOnly = false;

/**
 * Executes when a new member joins the guild
 *
 * @param client - The Discord client instance
 * @param member - The guild member who joined
 */
export async function execute(
  client: Client,
  member: GuildMember
): Promise<void> {
  if (!autoRoleConfig.enabled) {
    return;
  }

  if (!autoRoleConfig.roleId) {
    logger.warn("Auto-role system enabled but no role ID configured");
    return;
  }

  try {
    const success = await RoleManager.assign(
      member,
      autoRoleConfig.roleId,
      "Auto-assigned on join"
    );

    if (success) {
      logger.info(
        `Assigned Unverified role to ${member.user.tag} (${member.user.id})`
      );
    } else {
      logger.warn(
        `Failed to assign Unverified role to ${member.user.tag} (${member.user.id})`
      );
    }
  } catch (error) {
    logger.error(`Error assigning auto-role to ${member.user.tag}:`, error);
  }
}
