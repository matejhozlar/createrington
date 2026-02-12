import type { Client, GuildMember } from "discord.js";
import type {
  AnyRoleRule,
  RoleAssignmentNotification,
  RoleAssignmentResult,
  RoleEligibilityResult,
} from "./types";
import { RoleConditionType } from "./types";
import type { BaseRoleCondition } from "./conditions/base-condition";
import { PlaytimeCondition } from "./conditions/playtime-condition";
import config from "@/config";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { roleNotificationService } from "./role-notification.service";
import { getAllRoleRules } from "./config";
import { Q } from "@/db";
import { ServerAgeCondition } from "./conditions/server-age-condition";

/**
 * Service for managing automatic role assignments based on various conditions
 *
 * Features:
 * - Checks player eligibility against configured rules
 * - Assigns/removes roles based on conditions (playtime, balance, etc.)
 * - Handles role hierarchies (only assigns highest eligible role)
 * - Supports both realtime and scheduled checks
 * - Integrates with Discord role manager for actual role operations
 */
export class RoleAssignmentService {
  constructor(private readonly bot: Client) {}

  // ==========================================================================
  // ELIGIBILITY
  // ==========================================================================

  /**
   * Creates the appropriate condition checker for a given rule
   *
   * @param rule - The role assignment rule
   * @returns Condition checker instance
   *
   * @private
   */
  private createCondition(rule: AnyRoleRule): BaseRoleCondition {
    switch (rule.conditionType) {
      case RoleConditionType.PLAYTIME:
        return new PlaytimeCondition(rule);
      case RoleConditionType.SERVER_AGE:
        return new ServerAgeCondition(rule);
      default:
        throw new Error(`Unknown condition type: ${rule.conditionType}`);
    }
  }

  /**
   * Check if a player qualifies for a specific role
   *
   * @param discordId - Discord user ID of the player
   * @param rule - Role assignment rule to check
   * @returns Promise resolving to eligibility result
   */
  async checkEligibility(
    discordId: string,
    rule: AnyRoleRule,
  ): Promise<RoleEligibilityResult> {
    const condition = this.createCondition(rule);
    return await condition.checkEligibility(discordId);
  }

  /**
   * Check a player's eligibility for multiple roles
   *
   * @param discordId - Discord ID of the player
   * @param rules - Array of role assignment rules to check
   * @returns Promise resolving to array of eligibility results
   */
  async checkMultipleRoles(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<RoleEligibilityResult[]> {
    return await Promise.all(
      rules.map((rule) => this.checkEligibility(discordId, rule)),
    );
  }

  /**
   * Finds the highest eligible role in a hierarchy for a player
   *
   * Checks all roles from highest to lowest (by requiredValue) and returns
   * the first one player qualifies for. This prevents assigning multiple
   * roles in a hierarchy
   *
   * @param discordId - Discord user ID of the player
   * @param rules - Array of role rules (should be from same hierarchy)
   * @returns Promise resolving to the highest eligible rule, or null if none qualifies
   */
  async findHighestEligibleRole(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<{ rule: AnyRoleRule; eligibility: RoleEligibilityResult } | null> {
    const sortedRules = [...rules].sort((a, b) => {
      const aValue = this.getRequiredValue(a);
      const bValue = this.getRequiredValue(b);
      return bValue - aValue;
    });

    const eligibilities = await this.checkMultipleRoles(discordId, sortedRules);

    for (let i = 0; i < sortedRules.length; i++) {
      if (eligibilities[i].qualifies) {
        return {
          rule: sortedRules[i],
          eligibility: eligibilities[i],
        };
      }
    }

    return null;
  }

  /**
   * Gets the required value for a rule (handles different condition types)
   *
   * @param rule - The role rule
   * @returns Required value
   *
   * @private
   */
  private getRequiredValue(rule: AnyRoleRule): number {
    switch (rule.conditionType) {
      case RoleConditionType.PLAYTIME:
        return rule.requiredSeconds;
      case RoleConditionType.SERVER_AGE:
        return rule.requiredDays;
      default:
        return 0;
    }
  }

  // ==========================================================================
  // ASSIGNMENT
  // ==========================================================================

  /**
   * Processes role assignment for a hierarchy of roles
   *
   * Instead of processing each role independently, this method:
   * 1. Finds the highest role the player qualifies for
   * 2. Assigns only that role
   * 3. Removes all other roles in the hierarchy
   *
   * This prevents the spam of assigning and immediately removing roles.
   *
   * @param discordId - Discord ID of the player
   * @param rules - Array of role rules in the hierarchy (ordered doesn't matter)
   * @returns Promise resolving to assignment result
   */
  async processRoleHierarchy(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<RoleAssignmentResult> {
    try {
      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
      const member = await guild.members.fetch(discordId);

      const highest = await this.findHighestEligibleRole(discordId, rules);

      const allRoleIds = rules.map((r) => r.roleId);

      if (!highest) {
        const removedRoles: string[] = [];
        for (const roleId of allRoleIds) {
          if (RoleManager.has(member, roleId)) {
            const removed = await RoleManager.remove(
              member,
              roleId,
              "No longer qualifies for role hierarchy",
            );
            if (removed) {
              removedRoles.push(roleId);
            }
          }
        }

        return {
          success: true,
          rule: rules[0],
          discordId,
          assigned: false,
          removedRoles: removedRoles.length > 0 ? removedRoles : undefined,
        };
      }

      const { rule: targetRole, eligibility } = highest;

      const hasTargetRole = RoleManager.has(member, targetRole.roleId);
      const hasOtherRoles = allRoleIds.some(
        (roleId) =>
          roleId !== targetRole.roleId && RoleManager.has(member, roleId),
      );

      if (hasTargetRole && !hasOtherRoles) {
        return {
          success: true,
          rule: targetRole,
          discordId,
          assigned: false,
        };
      }

      let previousRole: AnyRoleRule | undefined;
      const currentRoleIds = allRoleIds.filter((roleId) =>
        RoleManager.has(member, roleId),
      );
      if (currentRoleIds.length > 0) {
        previousRole = rules.find((r) => r.roleId === currentRoleIds[0]);
      }

      const removedRoles: string[] = [];
      for (const roleId of allRoleIds) {
        if (roleId !== targetRole.roleId && RoleManager.has(member, roleId)) {
          const removed = await RoleManager.remove(
            member,
            roleId,
            `Upgrading to ${targetRole.label}`,
          );
          if (removed) {
            removedRoles.push(roleId);
          }
        }
      }

      let justAssigned = false;
      if (!hasTargetRole) {
        const assigned = await RoleManager.assign(
          member,
          targetRole.roleId,
          `Qualified for ${targetRole.label} (${eligibility.currentValue}/${eligibility.requiredValue})`,
        );

        if (!assigned) {
          return {
            success: false,
            rule: targetRole,
            discordId,
            assigned: false,
            error: "Failed to assign role",
          };
        }

        justAssigned = true;
      }

      if (justAssigned) {
        const notification: RoleAssignmentNotification = {
          discordId: member.id,
          username: member.user.username,
          role: targetRole,
          currentValue: eligibility.currentValue,
          requiredValue: eligibility.requiredValue,
          previousRole,
          timestamp: new Date(),
        };

        roleNotificationService
          .sendNotification(notification)
          .catch((error) => {
            logger.error("Failed to send role notification:", error);
          });
      }

      return {
        success: true,
        rule: targetRole,
        discordId,
        assigned: justAssigned,
        removedRoles: removedRoles.length > 0 ? removedRoles : undefined,
      };
    } catch (error) {
      logger.error(`Failed to process role hierarchy for ${discordId}:`, error);

      return {
        success: false,
        rule: rules[0],
        discordId,
        assigned: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Assigns or removes a role based on eligibility
   *
   * @deprecated Use processRoleHierarchy for hierarchical roles
   *
   * Workflow:
   * 1. Fetch guild member
   * 2. Check current eligibility
   * 3. If qualifies and doesn't have role -> assign role and remove hierarchy roles
   * 4. If doesn't qualify and has role -> remove role
   *
   * @param discordId - Discord user ID of the player
   * @param rule - Role assignment rule to process
   * @returns Promise resolving to assignment result
   */
  async processRoleAssignment(
    discordId: string,
    rule: AnyRoleRule,
  ): Promise<RoleAssignmentResult> {
    try {
      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
      const member = await guild.members.fetch(discordId);

      const eligibility = await this.checkEligibility(discordId, rule);

      if (eligibility.qualifies) {
        return await this.assignRole(member, rule, eligibility);
      } else {
        return await this.removeRole(member, rule);
      }
    } catch (error) {
      logger.error(
        `Failed to process role assignment for ${discordId} (${rule.label}):`,
        error,
      );

      return {
        success: false,
        rule,
        discordId,
        assigned: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Assigns a role to a member and removes hierarchy roles
   *
   * @param member - Guild member to assign role to
   * @param rule - Role assignment rule
   * @param eligibility - Eligibility result (for logging)
   * @returns Promise resolving to assignment result
   *
   * @private
   */
  private async assignRole(
    member: GuildMember,
    rule: AnyRoleRule,
    eligibility: RoleEligibilityResult,
  ): Promise<RoleAssignmentResult> {
    if (RoleManager.has(member, rule.roleId)) {
      return {
        success: true,
        rule,
        discordId: member.id,
        assigned: false,
      };
    }

    const assignedResult = await RoleManager.assign(
      member,
      rule.roleId,
      `Qualified for ${rule.label} (${eligibility.currentValue}/${eligibility.requiredValue})`,
    );

    if (!assignedResult) {
      return {
        success: false,
        rule,
        discordId: member.id,
        assigned: false,
        error: "Failed to assign role",
      };
    }

    let previousRole: AnyRoleRule | undefined;

    const removedRoles: string[] = [];
    if (rule.removesRoles && rule.removesRoles.length > 0) {
      const allRules = getAllRoleRules();

      for (const roleToRemove of rule.removesRoles) {
        if (RoleManager.has(member, roleToRemove)) {
          const removeResult = await RoleManager.remove(
            member,
            roleToRemove,
            `Upgraded to ${rule.label}`,
          );

          if (removeResult) {
            removedRoles.push(roleToRemove);

            if (!previousRole) {
              previousRole = allRules.find((r) => r.roleId === roleToRemove);
            }
          }
        }
      }
    }

    const notification: RoleAssignmentNotification = {
      discordId: member.id,
      username: member.user.username,
      role: rule,
      currentValue: eligibility.currentValue,
      requiredValue: eligibility.requiredValue,
      previousRole,
      timestamp: new Date(),
    };

    roleNotificationService.sendNotification(notification).catch((error) => {
      logger.error("Failed to send role notification:", error);
    });

    return {
      success: true,
      rule,
      discordId: member.id,
      assigned: false,
      removedRoles: removedRoles.length > 0 ? removedRoles : undefined,
    };
  }

  /**
   * Removes a role from a member if they have it
   *
   * @param member - Guild member to remove role from
   * @param rule - Role assignment rule
   * @returns Promise resolving to assignment result
   *
   * @private
   */
  private async removeRole(
    member: GuildMember,
    rule: AnyRoleRule,
  ): Promise<RoleAssignmentResult> {
    if (!RoleManager.has(member, rule.roleId)) {
      return {
        success: true,
        rule,
        discordId: member.id,
        assigned: false,
      };
    }

    const removeResult = await RoleManager.remove(
      member,
      rule.roleId,
      `No longer qualifies for ${rule.label}`,
    );

    if (!removeResult) {
      return {
        success: false,
        rule,
        discordId: member.id,
        assigned: false,
        error: "Failed to remove role",
      };
    }

    return {
      success: true,
      rule,
      discordId: member.id,
      assigned: false,
    };
  }

  /**
   * Process role assignments for a player across multiple rules
   *
   * @deprecated Use processRoleHierarchy for better hierarchy handling
   *
   * @param discordId - Discord user ID of the player
   * @param rules - Array of role assignments rules to process
   * @returns Promise resolving to an array of assignment results
   */
  async processMultipleRoles(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<RoleAssignmentResult[]> {
    return await Promise.all(
      rules.map((rule) => this.processRoleAssignment(discordId, rule)),
    );
  }

  // ==========================================================================
  // BATCH PROCESSING
  // ==========================================================================

  /**
   * Process role assignments for all registered players
   *
   * Useful for daily/scheduled checks across the entire player base
   * Uses processRoleHierarchy to avoid spamming role changes
   *
   * @param rules - Array of role assignment rules to check
   * @returns Promise resolving to a map of discordId -> result
   */
  async processAllPlayers(
    rules: AnyRoleRule[],
  ): Promise<Map<string, RoleAssignmentResult>> {
    const players = await Q.player.findAll({});

    const results = new Map<string, RoleAssignmentResult>();

    for (const player of players) {
      const result = await this.processRoleHierarchy(player.discordId, rules);
      results.set(player.discordId, result);
    }

    return results;
  }
}

export const createRoleAssignmentService = (
  bot: Client,
): RoleAssignmentService => new RoleAssignmentService(bot);
