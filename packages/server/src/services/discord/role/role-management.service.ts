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
 * Central service for managing role assignments
 *
 * Handles:
 * - Realtime role checks triggered by playtime events
 * - Daily scheduled role checks
 * - Integration with PlaytimeService
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

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize the service
   * Called by the service container during startup
   *
   * @returns Promise resolving when the service is initialized
   */
  async initialize(): Promise<void> {
    logger.info("Initializing RoleManagementService");

    this.startDailyScheduler();

    logger.info("RoleManagementService initialized");
  }

  /**
   * Shutdown the service
   * Called by the service container during graceful shutdown
   *
   * @returns Promise resolving when the service is stopped
   */
  async shutdown(): Promise<void> {
    this.stopDailyScheduler();
    logger.info("RoleManagementService stopped");
  }

  // ==========================================================================
  // REALTIME CHECKING
  // ==========================================================================

  /**
   * Sets up realtime role checking for a playtime service
   *
   * Subscribes to sessionEnd events and triggers role hierarchy checks.
   * Should be called after playtime services are initialized.
   *
   * @param serverId - Server ID to set up checking for
   * @param playtimeService - PlaytimeService instance to listen for events on
   */
  setupRealtimeRoleChecking(
    serverId: number,
    playtimeService: PlaytimeService,
  ): void {
    playtimeService.on("sessionEnd", async (event) => {
      logger.debug(
        `Session ended for ${event.username}, checking role eligibility`,
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

  // ==========================================================================
  // DAILY SCHEDULER
  // ==========================================================================

  /**
   * Start the daily role scheduler
   *
   * @private
   */
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

  /**
   * Stop the daily role scheduler
   *
   * @private
   */
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

  /**
   * Run the daily role check for all players
   *
   * @returns Promise resolving when the check is finished
   *
   * @private
   */
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

      // Top playtime roles (competitive, rank-based — only one holder at a time)
      const topPlaytimeRules = getTopPlaytimeRoleRules();
      for (const rule of topPlaytimeRules) {
        const result = await this.processTopPlaytimeRole(rule);
        if (result.assigned) totalAssignments++;
        if (result.removed) totalRemovals++;
      }

      // Top crypto networth roles (competitive, rank-based — only one holder at a time)
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

  // ==========================================================================
  // TOP PLAYTIME (COMPETITIVE)
  // ==========================================================================

  /**
   * Processes a competitive top-playtime role
   *
   * Finds the #1 player by total playtime across all servers, removes the role
   * from any current holder(s), and assigns it to the new leader.
   *
   * @param rule - The top playtime role rule
   * @returns Object indicating whether the role was assigned/removed
   *
   * @private
   */
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

      // Find all members who currently have the role
      const membersWithRole = guild.members.cache.filter((m) =>
        RoleManager.has(m, rule.roleId),
      );

      // Check if the top player already holds the role
      const topPlayerHasRole = membersWithRole.some(
        (m) => m.id === topPlayer.discordId,
      );

      if (topPlayerHasRole && membersWithRole.size === 1) {
        logger.debug(
          `Top playtime role "${rule.label}" already held by ${topPlayer.minecraftUsername}`,
        );
        return { assigned: false, removed: false };
      }

      // Remove the role from all current holders
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

      // Assign the role to the new top player
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

  // ==========================================================================
  // TOP CRYPTO NETWORTH (COMPETITIVE)
  // ==========================================================================

  /**
   * Processes a competitive top-crypto-networth role
   *
   * Finds the #1 player by total crypto portfolio value, removes the role
   * from any current holder(s), and assigns it to the new leader.
   *
   * @param rule - The top crypto networth role rule
   * @returns Object indicating whether the role was assigned/removed
   *
   * @private
   */
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

      // Find all members who currently have the role
      const membersWithRole = guild.members.cache.filter((m) =>
        RoleManager.has(m, rule.roleId),
      );

      // Check if the top player already holds the role
      const topPlayerHasRole = membersWithRole.some(
        (m) => m.id === topPlayer.discordId,
      );

      if (topPlayerHasRole && membersWithRole.size === 1) {
        logger.debug(
          `Top crypto networth role "${rule.label}" already held by ${topEntry.playerName}`,
        );
        return { assigned: false, removed: false };
      }

      // Remove the role from all current holders
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

      // Assign the role to the new top player
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

  // ==========================================================================
  // MANUAL TRIGGERS
  // ==========================================================================

  /**
   * Manually triggers a role check for a specific player
   *
   * @param discordId - Discord user ID of the player
   */
  async checkPlayer(discordId: string): Promise<void> {
    const rules = getRealtimeRoleRules();
    await this.roleAssignmentService.processRoleHierarchy(discordId, rules);
  }

  /**
   * Manually triggers a daily check (for testing and admin commands)
   */
  async triggerManualDailyCheck(): Promise<void> {
    await this.runDailyCheck();
  }
}
