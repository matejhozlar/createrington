import type { Client } from "discord.js";
import { RoleAssignmentService } from "./role-assignment.service";
import type { PlaytimeService } from "@/services/playtime";
import { Q } from "@/db";
import {
  getDailyRoleRules,
  getRealtimeRoleRules,
  getTopPlaytimeRoleRules,
  getTopCryptoNetworthRoleRules,
} from "./config";
import { RoleConditionType } from "./types";
import type { TopPlaytimeRoleRule, TopCryptoNetworthRoleRule } from "./types";
import { getLeaderboard } from "@/services/crypto/analytics/leaderboard";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { roleNotificationService } from "./role-notification.service";
import config from "@/config";

/**
 * Top-level coordinator for automatic role assignment. Owns a
 * `RoleAssignmentService` and drives it from two triggers: realtime, by
 * subscribing to per-server `PlaytimeService` `sessionAggregated` events, and
 * scheduled, via a daily timer aligned to `checkTimeHour` UTC (first run is
 * delayed to the next occurrence, then a 24h interval takes over). The daily
 * pass also reconciles competitive top-1 roles (top playtime, top crypto
 * networth) by stripping the role from former leaders and granting it to the
 * current #1. All scheduling stops on `shutdown`.
 */
export class RoleManagementService {
  private roleAssignmentService: RoleAssignmentService;
  private dailyCheckIntervalId?: NodeJS.Timeout;
  private dailyCheckTimeoutId?: NodeJS.Timeout;

  constructor(
    private readonly client: Client,
    private readonly checkTimeHour: number = 0,
  ) {
    this.roleAssignmentService = new RoleAssignmentService(client);
  }

  /** Starts the daily role-check scheduler. Realtime hooks are wired separately via `setupRealtimeRoleChecking`. */
  async initialize(): Promise<void> {
    logger.info("Initializing RoleManagementService");

    this.startDailyScheduler();

    logger.info("RoleManagementService initialized");
  }

  /** Cancels the daily scheduler (both the initial timeout and the recurring interval). Realtime listeners stay bound to the underlying `PlaytimeService`. */
  async shutdown(): Promise<void> {
    this.stopDailyScheduler();
    logger.info("RoleManagementService stopped");
  }

  /**
   * Subscribes to `sessionAggregated` on the given `PlaytimeService` and runs
   * the realtime rule set through `processRoleHierarchy` on each event. Call
   * once per server after its playtime service is initialized; listeners are
   * not removed on shutdown.
   */
  setupRealtimeRoleChecking(
    serverId: number,
    playtimeService: PlaytimeService,
  ): void {
    playtimeService.on("sessionAggregated", async (event) => {
      logger.debug(
        `Session aggregated for ${event.username}, checking role eligibility`,
      );

      try {
        const player = await Q.player.find({ minecraftUuid: event.uuid });

        if (!player) {
          logger.warn(`No player found with UUID ${event.uuid} for role check`);
          return;
        }

        const rules = getRealtimeRoleRules();
        await this.roleAssignmentService.processRoleHierarchy(
          player.discordId,
          rules,
        );
      } catch (error) {
        logger.error(
          `Failed to process realtime role check for ${event.username}:`,
          error,
        );
      }
    });

    logger.info(`Realtime role checking setup for server ${serverId}`);
  }

  private startDailyScheduler(): void {
    logger.info(
      `Starting daily role scheduler (checks at ${this.checkTimeHour}:00 UTC)`,
    );

    const now = new Date();
    const nextCheck = new Date();

    nextCheck.setUTCHours(this.checkTimeHour, 0, 0, 0);

    if (nextCheck <= now) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }

    const msUntilNextCheck = nextCheck.getTime() - now.getTime();

    logger.info(
      `First daily role check in ${Math.round(msUntilNextCheck / 1000 / 60)} minute(s)`,
    );

    this.dailyCheckTimeoutId = setTimeout(() => {
      this.runDailyCheck();

      this.dailyCheckIntervalId = setInterval(
        () => this.runDailyCheck(),
        24 * 60 * 60 * 1000, // 24 hours
      );
    }, msUntilNextCheck);
  }

  private stopDailyScheduler(): void {
    if (this.dailyCheckTimeoutId) {
      clearTimeout(this.dailyCheckTimeoutId);
      this.dailyCheckTimeoutId = undefined;
    }

    if (this.dailyCheckIntervalId) {
      clearInterval(this.dailyCheckIntervalId);
      this.dailyCheckIntervalId = undefined;
    }

    logger.info("Daily role scheduler stopped");
  }

  private async runDailyCheck(): Promise<void> {
    logger.info("Running daily role check...");

    try {
      const rules = getDailyRoleRules();

      if (rules.length === 0) {
        logger.warn("No daily rules configured");
        return;
      }

      const playtimeRules = rules.filter(
        (r) => r.conditionType === RoleConditionType.PLAYTIME,
      );
      const serverAgeRules = rules.filter(
        (r) => r.conditionType === RoleConditionType.SERVER_AGE,
      );

      let totalAssignments = 0;
      let totalRemovals = 0;

      if (playtimeRules.length > 0) {
        const playtimeResults =
          await this.roleAssignmentService.processAllPlayers(playtimeRules);
        for (const [, result] of playtimeResults) {
          if (result.success && result.assigned) totalAssignments++;
          if (result.removedRoles) totalRemovals += result.removedRoles.length;
        }
      }

      if (serverAgeRules.length > 0) {
        const serverAgeResults =
          await this.roleAssignmentService.processAllPlayers(serverAgeRules);
        for (const [, result] of serverAgeResults) {
          if (result.success && result.assigned) totalAssignments++;
          if (result.removedRoles) totalRemovals += result.removedRoles.length;
        }
      }

      // Top playtime roles (competitive, rank-based: only one holder at a time)
      const topPlaytimeRules = getTopPlaytimeRoleRules();
      for (const rule of topPlaytimeRules) {
        const result = await this.processTopPlaytimeRole(rule);
        if (result.assigned) totalAssignments++;
        if (result.removed) totalRemovals++;
      }

      // Top crypto networth roles (competitive, rank-based: only one holder at a time)
      const topCryptoRules = getTopCryptoNetworthRoleRules();
      for (const rule of topCryptoRules) {
        const result = await this.processTopCryptoNetworthRole(rule);
        if (result.assigned) totalAssignments++;
        if (result.removed) totalRemovals++;
      }

      logger.info(
        `Daily role check complete: ${totalAssignments} role(s) assigned, ${totalRemovals} role(s) removed`,
      );
    } catch (error) {
      logger.error("Daily role check failed:", error);
    }
  }

  private async processTopPlaytimeRole(
    rule: TopPlaytimeRoleRule,
  ): Promise<{ assigned: boolean; removed: boolean }> {
    try {
      const leaderboard =
        await Q.player.playtime.summary.getGlobalLeaderboard(1);

      if (leaderboard.length === 0) {
        logger.warn("No players found for top playtime role check");
        return { assigned: false, removed: false };
      }

      const topPlayer = leaderboard[0];
      const guild = await this.client.guilds.fetch(config.discord.guild.id);

      const membersWithRole = guild.members.cache.filter((m) =>
        RoleManager.has(m, rule.roleId),
      );

      const topPlayerHasRole = membersWithRole.some(
        (m) => m.id === topPlayer.discordId,
      );

      if (topPlayerHasRole && membersWithRole.size === 1) {
        logger.debug(
          `Top playtime role "${rule.label}" already held by ${topPlayer.minecraftUsername}`,
        );
        return { assigned: false, removed: false };
      }

      let removed = false;
      for (const [, member] of membersWithRole) {
        if (member.id !== topPlayer.discordId) {
          await RoleManager.remove(
            member,
            rule.roleId,
            `No longer the #1 player by playtime`,
          );
          removed = true;
        }
      }

      let assigned = false;
      if (!topPlayerHasRole) {
        try {
          const topMember = await guild.members.fetch(topPlayer.discordId);
          const result = await RoleManager.assign(
            topMember,
            rule.roleId,
            `#1 player by total playtime (${topPlayer.totalSeconds}s)`,
          );

          if (result) {
            assigned = true;

            roleNotificationService
              .sendNotification({
                discordId: topPlayer.discordId,
                username: topPlayer.minecraftUsername,
                role: rule,
                currentValue: topPlayer.totalSeconds,
                requiredValue: 0,
                timestamp: new Date(),
              })
              .catch((error) => {
                logger.error("Failed to send top player announcement:", error);
              });

            logger.info(
              `Assigned top playtime role "${rule.label}" to ${topPlayer.minecraftUsername}`,
            );
          }
        } catch (error) {
          logger.error(
            `Failed to assign top playtime role to ${topPlayer.discordId}:`,
            error,
          );
        }
      }

      return { assigned, removed };
    } catch (error) {
      logger.error("Failed to process top playtime role:", error);
      return { assigned: false, removed: false };
    }
  }

  private async processTopCryptoNetworthRole(
    rule: TopCryptoNetworthRoleRule,
  ): Promise<{ assigned: boolean; removed: boolean }> {
    try {
      const leaderboard = await getLeaderboard("networth", 1);

      if (leaderboard.length === 0) {
        logger.warn("No players found for top crypto networth role check");
        return { assigned: false, removed: false };
      }

      const topEntry = leaderboard[0];
      const topPlayer = await Q.player.find({
        minecraftUuid: topEntry.playerUuid,
      });

      if (!topPlayer) {
        logger.warn(
          `No player record found for top crypto player UUID ${topEntry.playerUuid}`,
        );
        return { assigned: false, removed: false };
      }

      const guild = await this.client.guilds.fetch(config.discord.guild.id);

      const membersWithRole = guild.members.cache.filter((m) =>
        RoleManager.has(m, rule.roleId),
      );

      const topPlayerHasRole = membersWithRole.some(
        (m) => m.id === topPlayer.discordId,
      );

      if (topPlayerHasRole && membersWithRole.size === 1) {
        logger.debug(
          `Top crypto networth role "${rule.label}" already held by ${topEntry.playerName}`,
        );
        return { assigned: false, removed: false };
      }

      let removed = false;
      for (const [, member] of membersWithRole) {
        if (member.id !== topPlayer.discordId) {
          await RoleManager.remove(
            member,
            rule.roleId,
            `No longer the #1 player by crypto portfolio value`,
          );
          removed = true;
        }
      }

      let assigned = false;
      if (!topPlayerHasRole) {
        try {
          const topMember = await guild.members.fetch(topPlayer.discordId);
          const portfolioValue = parseFloat(topEntry.value);
          const result = await RoleManager.assign(
            topMember,
            rule.roleId,
            `#1 player by crypto portfolio value ($${topEntry.value})`,
          );

          if (result) {
            assigned = true;

            roleNotificationService
              .sendNotification({
                discordId: topPlayer.discordId,
                username: topEntry.playerName,
                role: rule,
                currentValue: portfolioValue,
                requiredValue: 0,
                timestamp: new Date(),
              })
              .catch((error) => {
                logger.error(
                  "Failed to send crypto baron announcement:",
                  error,
                );
              });

            logger.info(
              `Assigned top crypto networth role "${rule.label}" to ${topEntry.playerName}`,
            );
          }
        } catch (error) {
          logger.error(
            `Failed to assign top crypto networth role to ${topPlayer.discordId}:`,
            error,
          );
        }
      }

      return { assigned, removed };
    } catch (error) {
      logger.error("Failed to process top crypto networth role:", error);
      return { assigned: false, removed: false };
    }
  }

  /** Runs the realtime rule set against a single player on demand (e.g. admin command), bypassing the playtime-event trigger. */
  async checkPlayer(discordId: string): Promise<void> {
    const rules = getRealtimeRoleRules();
    await this.roleAssignmentService.processRoleHierarchy(discordId, rules);
  }

  /** Runs the full daily sweep immediately, independent of the scheduler. Useful for admin commands and tests. */
  async triggerManualDailyCheck(): Promise<void> {
    await this.runDailyCheck();
  }
}
