import type { Client, GuildMember } from "discord.js";
import type {
  AnyRoleRule,
  RoleAssignmentNotification,
  RoleAssignmentResult,
  RoleEligibilityResult,
} from "./types";
import { RoleConditionType } from "./types";
import {
  evaluateRule,
  requiredValueOf,
  type RoleConditionContext,
} from "./conditions";
import config from "@/config";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { loadAllGuildMembers } from "@/discord/utils/guild-members";
import { roleNotificationService } from "./role-notification.service";
import { Q } from "@/db";
import type { Player, PlayerPlaytimeSummary } from "@createrington/shared/db";

type PlaytimeByPlayer = Map<string, Map<number, number>>;

function groupPlaytime(rows: PlayerPlaytimeSummary[]): PlaytimeByPlayer {
  const byPlayer: PlaytimeByPlayer = new Map();
  for (const row of rows) {
    let byServer = byPlayer.get(row.playerMinecraftUuid);
    if (!byServer) {
      byServer = new Map();
      byPlayer.set(row.playerMinecraftUuid, byServer);
    }
    byServer.set(row.serverId, Number(row.totalSeconds));
  }
  return byPlayer;
}

function needsPlaytime(rules: AnyRoleRule[]): boolean {
  return rules.some(
    (rule) => rule.conditionType === RoleConditionType.PLAYTIME,
  );
}

/**
 * Evaluates player eligibility against configured role rules (playtime, server
 * age) and reconciles Discord role state to match. Every rule is evaluated
 * against one preloaded context per player (the player row plus its playtime
 * summaries), so a hierarchy of any size costs a single playtime read.
 * Hierarchy-aware: only the highest-tier role a player qualifies for is kept
 * and the lower tiers are removed in the same pass. Roles are added and
 * removed individually rather than replaced wholesale, so concurrent role
 * changes are never overwritten from a stale member cache. Notifications are
 * dispatched asynchronously and never block role ops. Errors are caught per
 * player so a single failure does not abort batch runs.
 */
export class RoleAssignmentService {
  constructor(private readonly bot: Client) {}

  private findHighestEligibleRole(
    rules: AnyRoleRule[],
    context: RoleConditionContext,
  ): { rule: AnyRoleRule; eligibility: RoleEligibilityResult } | null {
    const sortedRules = [...rules].sort(
      (a, b) => requiredValueOf(b) - requiredValueOf(a),
    );

    for (const rule of sortedRules) {
      const eligibility = evaluateRule(rule, context);
      if (eligibility.qualifies) return { rule, eligibility };
    }

    return null;
  }

  private async loadContext(
    player: Player,
    rules: AnyRoleRule[],
  ): Promise<RoleConditionContext> {
    const summaries = needsPlaytime(rules)
      ? await Q.player.playtime.summary.findAll({
          playerMinecraftUuid: player.minecraftUuid,
        })
      : [];

    return {
      discordId: player.discordId,
      createdAt: player.createdAt,
      playtimeByServer:
        groupPlaytime(summaries).get(player.minecraftUuid) ?? new Map(),
    };
  }

  /**
   * Reconciles one player's roles against a single hierarchy: fetches the
   * guild member, loads the player's condition context once, then keeps only
   * the highest qualifying tier. Input rule order is irrelevant; ranking is by
   * required value.
   */
  async processRoleHierarchy(
    player: Player,
    rules: AnyRoleRule[],
  ): Promise<RoleAssignmentResult> {
    try {
      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
      const member = await guild.members.fetch(player.discordId);
      const context = await this.loadContext(player, rules);

      return await this.reconcileHierarchy(member, rules, context);
    } catch (error) {
      logger.error(
        `Failed to process role hierarchy for ${player.discordId}:`,
        error,
      );
      return this.failure(player.discordId, rules, error);
    }
  }

  /**
   * Daily sweep: loads the full guild member list, every player and (when a
   * hierarchy needs it) every playtime summary up front, then reconciles each
   * guild member against every given hierarchy. Players who are not in the
   * guild are skipped. Sequential to keep Discord rate limit pressure bounded.
   */
  async processAllPlayers(
    hierarchies: AnyRoleRule[][],
  ): Promise<RoleAssignmentResult[]> {
    const guild = await loadAllGuildMembers(
      await this.bot.guilds.fetch(config.discord.guild.id),
    );

    const [players, summaries] = await Promise.all([
      Q.player.findAll({}),
      needsPlaytime(hierarchies.flat())
        ? Q.player.playtime.summary.findAll({})
        : Promise.resolve([]),
    ]);
    const playtime = groupPlaytime(summaries);

    const results: RoleAssignmentResult[] = [];

    for (const player of players) {
      const member = guild.members.cache.get(player.discordId);
      if (!member) continue;

      const context: RoleConditionContext = {
        discordId: player.discordId,
        createdAt: player.createdAt,
        playtimeByServer: playtime.get(player.minecraftUuid) ?? new Map(),
      };

      for (const rules of hierarchies) {
        results.push(await this.reconcileHierarchy(member, rules, context));
      }
    }

    return results;
  }

  private failure(
    discordId: string,
    rules: AnyRoleRule[],
    error: unknown,
  ): RoleAssignmentResult {
    return {
      success: false,
      rule: rules[0],
      discordId,
      assigned: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  private async reconcileHierarchy(
    member: GuildMember,
    rules: AnyRoleRule[],
    context: RoleConditionContext,
  ): Promise<RoleAssignmentResult> {
    const discordId = member.id;

    try {
      const highest = this.findHighestEligibleRole(rules, context);

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
          roleColor: RoleManager.colorOf(member, targetRole.roleId),
          currentValue: eligibility.currentValue,
          requiredValue: eligibility.requiredValue,
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
      return this.failure(discordId, rules, error);
    }
  }
}
