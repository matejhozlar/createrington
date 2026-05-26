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
 * Evaluates player eligibility against configured role rules (playtime, server
 * age, etc.) and reconciles Discord role state to match. Hierarchy-aware:
 * `processRoleHierarchy` assigns only the highest-tier role a player qualifies
 * for and removes the lower tiers in a single pass, avoiding assign/remove
 * churn. Notifications are dispatched asynchronously and never block role ops.
 * Errors are caught per-player so a single failure does not abort batch runs.
 */
export class RoleAssignmentService {
  constructor(private readonly bot: Client) {}

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

  /** Checks whether a player currently satisfies the rule's condition. */
  async checkEligibility(
    discordId: string,
    rule: AnyRoleRule,
  ): Promise<RoleEligibilityResult> {
    const condition = this.createCondition(rule);
    return await condition.checkEligibility(discordId);
  }

  /** Checks eligibility for multiple rules in parallel; results map 1:1 to the input order. */
  async checkMultipleRoles(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<RoleEligibilityResult[]> {
    return await Promise.all(
      rules.map((rule) => this.checkEligibility(discordId, rule)),
    );
  }

  /**
   * Returns the highest-tier rule (by required value) the player qualifies
   * for, or null if none. Caller must pass rules from a single hierarchy;
   * mixing hierarchies will produce nonsense rankings.
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

  /**
   * Reconciles a player's roles against a single hierarchy: assigns the
   * highest qualifying tier (if any), removes every lower tier in one pass,
   * and only fires the rank-up notification when the target role was actually
   * just added. The new role is granted before stripping old ones so an
   * assign failure leaves the player on their existing tier rather than
   * roleless. Input rule order is irrelevant; ranking is by required value.
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

      // Assign the new role BEFORE removing old ones so that if the assign
      // fails, the player keeps their current role instead of ending up with
      // no role at all.
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
   * Single-rule version of role reconciliation: assigns if the player
   * qualifies (and removes anything listed in `rule.removesRoles`), otherwise
   * strips the role.
   *
   * @deprecated Prefer `processRoleHierarchy` so the full tier set is
   * considered together; processing rules independently can churn assigns
   * and removes within the same hierarchy.
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
   * Runs `processRoleAssignment` for each rule in parallel.
   *
   * @deprecated Prefer `processRoleHierarchy` when the rules belong to a
   * single hierarchy; this method treats them independently.
   */
  async processMultipleRoles(
    discordId: string,
    rules: AnyRoleRule[],
  ): Promise<RoleAssignmentResult[]> {
    return await Promise.all(
      rules.map((rule) => this.processRoleAssignment(discordId, rule)),
    );
  }

  /**
   * Runs `processRoleHierarchy` sequentially for every registered player.
   * Intended for daily scheduled sweeps; sequential to keep Discord rate
   * limit pressure bounded.
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
