import type { Client } from "discord.js";
import { RoleAssignmentService } from "../role-assignment.service";
import { getDailyRoleRules } from "../config";
import { RoleConditionType } from "../types";

/**
 * Handles scheduled daily role checks
 *
 * Runs at configured time each day to check if players qualify for
 * any daily-check roles (like "The Sleepless" for top playtime)
 */
export class DailyRoleScheduler {
  private roleService: RoleAssignmentService;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private bot: Client,
    private checkTimeHour: number = 0,
  ) {
    this.roleService = new RoleAssignmentService(bot);
  }

  /**
   * Starts the daily scheduler
   *
   * Calculates time until next check and sets up recurring interval
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("DailyRoleScheduler is already running");
      return;
    }

    this.isRunning = true;
    logger.info(
      `Starting DailyRoleScheduler (checks at ${this.checkTimeHour}:00 UTC)`,
    );

    const now = new Date();
    const nextCheck = new Date();

    nextCheck.setUTCHours(this.checkTimeHour, 0, 0, 0);

    if (nextCheck <= now) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }

    const msUntilNextCheck = nextCheck.getTime() - now.getTime();

    logger.info(
      `First daily role check in ${Math.round(
        msUntilNextCheck / 1000 / 60,
      )} minutes`,
    );

    setTimeout(() => {
      if (this.isRunning) {
        this.runDailyCheck();

        this.intervalId = setInterval(
          () => this.runDailyCheck(),
          24 * 60 * 60 * 1000, // 24 hours
        );
      }
    }, msUntilNextCheck);
  }

  /**
   * Stops the daily scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info("DailyRoleScheduler stopped");
  }

  /**
   * Runs the daily role check for all players
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
          await this.roleService.processAllPlayers(playtimeRules);
        for (const [_discordId, result] of playtimeResults) {
          if (result.success && result.assigned) totalAssignments++;
          if (result.removedRoles) totalRemovals += result.removedRoles.length;
        }
      }

      if (serverAgeRules.length > 0) {
        const serverAgeResult =
          await this.roleService.processAllPlayers(serverAgeRules);
        for (const [_discordId, result] of serverAgeResult) {
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

  /**
   * Manually trigger a daily check (for testing or admin commands)
   */
  async triggerManualCheck(): Promise<void> {
    await this.runDailyCheck();
  }
}
