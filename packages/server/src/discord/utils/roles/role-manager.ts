import type { GuildMember } from "discord.js";

/**
 * Role manager utility for handling role assignments throughout the bot
 * Provides consistent error handling and logging for role operations
 */
export class RoleManager {
  /**
   * Assigns a role to a guild member
   *
   * @param member - The guild member to assign the role to
   * @param roleId - The ID of the role to assign
   * @param reason - Optional reason for the role assignment
   * @returns Promise resolving to true if successful, false otherwise
   */
  static async assign(
    member: GuildMember,
    roleId: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      const role = member.guild.roles.cache.get(roleId);

      if (!role) {
        logger.warn(`Role ${roleId} not found in guild ${member.guild.id}`);
        return false;
      }

      if (member.roles.cache.has(roleId)) {
        logger.debug(`Member ${member.user.tag} already has role ${role.name}`);
        return true;
      }

      await member.roles.add(role, reason);
      logger.info(
        `Assigned role ${role.name} to ${member.user.tag}${
          reason ? ` - Reason: ${reason}` : ""
        }`,
      );
      return true;
    } catch (error) {
      logger.error(
        `Failed to assign role ${roleId} to ${member.user.tag}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Removes a role from a guild member
   *
   * @param member - The guild member to remove the role from
   * @param roleId - The ID of the role to remove
   * @param reason - Optional reason for the role removal
   * @returns Promise resolving to true if successful, false otherwise
   */
  static async remove(
    member: GuildMember,
    roleId: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      const role = member.guild.roles.cache.get(roleId);

      if (!role) {
        logger.warn(`Role ${roleId} not found in ${member.guild.id}`);
        return false;
      }

      if (!member.roles.cache.has(roleId)) {
        logger.debug(
          `Member ${member.user.tag} doesn't have role ${role.name}`,
        );
        return true;
      }

      await member.roles.remove(role, reason);
      logger.info(
        `Removed role ${role.name} from ${member.user.tag}${
          reason ? ` - Reason: ${reason}` : ""
        }`,
      );
      return true;
    } catch (error) {
      logger.error(
        `Failed to remove role ${roleId} from ${member.user.tag}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Checks if a member has a specific role
   *
   * @param member - The guild member to check
   * @param roleId - The ID of the role to check for
   * @returns True if the member has the role, false otherwise
   */
  static has(member: GuildMember, roleId: string): boolean {
    return member.roles.cache.has(roleId);
  }

  /**
   * Reads a role's own color from the member's guild
   *
   * @param member - The guild member whose guild holds the role
   * @param roleId - The ID of the role to read
   * @returns The role color, or 0 when the role is uncolored or missing
   */
  static colorOf(member: GuildMember, roleId: string): number {
    return member.guild.roles.cache.get(roleId)?.color ?? 0;
  }
}
