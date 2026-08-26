import type { GuildMember, Role } from "discord.js";

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
   * @private
   */
  private static async assignRole(
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
   * Assigns one or more roles to a guild member
   *
   * @param member - The guild member to assign the role(s) to
   * @param roleIdOrIds - Discord role ID or an array of role IDs
   * @param reason - Optional reason for the assigments
   *
   * @returns Promise resolving to true if singular ID,
   * object with count of successful and failed if array of IDs, false otherwise
   */
  static async assign(
    member: GuildMember,
    roleIdOrIds: string | string[],
    reason?: string,
  ): Promise<boolean | { successful: number; failed: number }> {
    if (typeof roleIdOrIds === "string") {
      return this.assignRole(member, roleIdOrIds, reason);
    }

    let successful = 0;
    let failed = 0;

    for (const roleId of roleIdOrIds) {
      const result = await this.assignRole(member, roleId, reason);
      if (result) successful++;
      else failed++;
    }

    return { successful, failed };
  }

  /**
   * Removes a role from a guild member
   *
   * @param member - The guild member to remove the role from
   * @param roleId - The ID of the role to remove
   * @param reason - Optional reason for the role removal
   * @returns Promise resolving to true if successful, false otherwise
   */
  private static async removeRole(
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
   * Removes one or more roles to a guild member
   *
   * @param member - The guild member to remove the role(s) from
   * @param roleIdOrIds - Discord role ID or an array of role IDs
   * @param reason - Optional reason for the removals
   *
   * @returns Promise resolving to true if singular ID,
   * object with count of successful and failed if array of IDs, false otherwise
   */
  static async remove(
    member: GuildMember,
    roleIdOrIds: string | string[],
    reason?: string,
  ): Promise<boolean | { successful: number; failed: number }> {
    if (typeof roleIdOrIds === "string") {
      return this.removeRole(member, roleIdOrIds, reason);
    }

    let successful = 0;
    let failed = 0;

    for (const roleId of roleIdOrIds) {
      const result = await this.removeRole(member, roleId, reason);
      if (result) successful++;
      else failed++;
    }

    return { successful, failed };
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
   * Checks if a member has any of the specified roles
   *
   * @param member - The guild member to check
   * @param roleIds - Array of role IDs to check for
   * @returns True if the member has at least one of the roles, false otherwise
   */
  static hasAny(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.some((roleId) => member.roles.cache.has(roleId));
  }

  /**
   * Checks if a member has all of the specified roles
   *
   * @param member - The guild member to check
   * @param roleIds - Array of role IDs to check for
   * @returns True if the member has all of the roles, false otherwise
   */
  static hasAll(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.every((roleId) => member.roles.cache.has(roleId));
  }

  /**
   * Replaces a member's role with another role (atomic swap)
   *
   * @param member - The guild member
   * @param oldRoleId - The role to remove
   * @param newRoleId - The role to add
   * @param reason - Optional reason for the role swap
   * @returns Promise resolving to true if successful, false otherwise
   */
  static async swap(
    member: GuildMember,
    oldRoleId: string,
    newRoleId: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      const oldRole = member.guild.roles.cache.get(oldRoleId);
      const newRole = member.guild.roles.cache.get(newRoleId);

      if (!oldRole || !newRole) {
        logger.warn("One or both roles not found for swap operation");
        return false;
      }

      await member.roles.remove(oldRole, reason);
      await member.roles.add(newRole, reason);

      logger.info(
        `Swapped role ${oldRole.name} -> ${newRole.name} for ${member.user.tag}`,
      );
      return true;
    } catch (error) {
      logger.error(`Failed to swarp roles for ${member.user.tag}:`, error);
      return false;
    }
  }

  /**
   * Gets all role IDs that a member has
   *
   * @param member - The guild member
   * @returns Array of role IDs (excluding @everyone)
   */
  static getAll(member: GuildMember): string[] {
    return member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => role.id);
  }

  /**
   * Gets all roles that a member has
   *
   * @param member - The guild member
   * @returns Array of role objects (excluding @everyone)
   */
  static getRoles(member: GuildMember): Role[] {
    return member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .toJSON();
  }
}
