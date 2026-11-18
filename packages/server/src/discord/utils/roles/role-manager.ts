import type { GuildMember } from "discord.js";

export class RoleManager {
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

  static has(member: GuildMember, roleId: string): boolean {
    return member.roles.cache.has(roleId);
  }

  static colorOf(member: GuildMember, roleId: string): number {
    return member.guild.roles.cache.get(roleId)?.color ?? 0;
  }
}
