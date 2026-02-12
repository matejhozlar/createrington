import type { Client } from "discord.js";
import { RoleAssignmentService } from "./role-assignment.service";
import type { PlaytimeService } from "@/services/playtime";
import { Q } from "@/db";
import { getDailyRoleRules, getRealtimeRoleRules } from "./config";
import { RoleConditionType } from "./types";

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
   * Setup realtime role checking for a playtime service
   * This should be called after playtime services are initialized
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

      logger.info(
        `Daily role check complete: ${totalAssignments} role(s) assigned, ${totalRemovals} role(s) removed`,
      );
    } catch (error) {
      logger.error("Daily role check failed:", error);
    }
  }

  // ==========================================================================
  // MANUAL TRIGGERS
  // ==========================================================================

  /**
   * Manually trigger a role check for a specific player
   */
  async checkPlayer(discordId: string): Promise<void> {
    const rules = getRealtimeRoleRules();
    await this.roleAssignmentService.processRoleHierarchy(discordId, rules);
  }

  /**
   * Manually trigger a daily check (for testing and admin commands)
   */
  async triggerManualDailyCheck(): Promise<void> {
    await this.runDailyCheck();
  }
}
