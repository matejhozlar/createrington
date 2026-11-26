import { Q } from "@/db";
import { ConflictError } from "@/errors";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import { settings } from "@/services/settings";
import { removeInactiveWarning } from "./remove-warning";
import {
  INACTIVITY_CHECK_INTERVAL_MS,
  INACTIVITY_DUE_CHECK_INTERVAL_MS,
  INACTIVITY_GRACE_DAYS,
  INACTIVITY_INACTIVE_DAYS,
  INACTIVITY_RETENTION_DAYS,
} from "./constants";

export type InactivityTriggerContext = {
  discordId: string;
  username: string | null;
} | null;

/**
 * Inactivity Cleanup Service
 *
 * Periodically checks for players who haven't logged in for 60+ days and
 * manages a two-phase removal process:
 *
 * 1. **Warning phase**: Identifies inactive players, creates warning records,
 *    and sends an announcement embed mentioning them. Players have 14 days
 *    to log back in.
 *
 * 2. **Resolution phase**: Checks if warned players have logged in since
 *    their warning. If so, the warning is resolved automatically.
 *
 * 3. **Removal phase**: After the 14-day grace period, players who haven't
 *    returned are kicked from Discord, removed from the whitelist, and their
 *    player record is deleted.
 *
 * 4. **Retention phase**: Warnings resolved or removed more than 30 days
 *    ago are deleted so the admin list only shows recent history.
 *
 * Players listed in `player_inactivity_exemption` are skipped by the warning
 * and removal phases entirely.
 *
 * Warning and removal state is persisted in the `player_inactivity_warning`
 * table, and the time of the last full cycle in the `inactivity_cycle_ran_at`
 * app setting, so the weekly schedule survives restarts and redeploys: an
 * hourly tick (and startup) runs the full cycle once a week has passed since
 * the last one, and startup otherwise runs only resolve+remove.
 *
 * Runs never overlap: an hourly tick that finds a run in progress is skipped,
 * and a manual or forced run is refused with `ConflictError`.
 */
export class InactivityCleanupService {
  private intervalId?: NodeJS.Timeout;
  private runInFlight = false;

  /** Run the full cycle if one is due (resolve+remove otherwise), then arm the hourly due check. */
  initialize(): void {
    logger.info("Initializing InactivityCleanupService...");

    this.runStartup().catch((error) => {
      logger.error("Initial inactivity cleanup run failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.runIfDue().catch((error) => {
        logger.error("Scheduled inactivity cleanup cycle failed:", error);
      });
    }, INACTIVITY_DUE_CHECK_INTERVAL_MS);

    logger.info(
      `InactivityCleanupService initialized (full cycle every ${INACTIVITY_CHECK_INTERVAL_MS / 86400000}d, inactive threshold: ${INACTIVITY_INACTIVE_DAYS}d, grace period: ${INACTIVITY_GRACE_DAYS}d, retention: ${INACTIVITY_RETENTION_DAYS}d)`,
    );
  }

  /** Stop the hourly due check. Safe to call multiple times. */
  shutdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("InactivityCleanupService stopped");
    }
  }

  private async runStartup(): Promise<void> {
    await this.exclusive(async () => {
      if (await this.isCycleDue()) {
        await this.runRecordedCycle();
      } else {
        await this.resolveAndRemoveOnly();
      }
    });
  }

  private async runIfDue(): Promise<void> {
    if (this.runInFlight) return;

    await this.exclusive(async () => {
      if (await this.isCycleDue()) {
        await this.runRecordedCycle();
      }
    });
  }

  private async isCycleDue(): Promise<boolean> {
    const ranAt = await settings.getInactivityCycleRanAt();
    if (ranAt && Date.now() - ranAt.getTime() < INACTIVITY_CHECK_INTERVAL_MS) {
      return false;
    }

    logger.info("Weekly inactivity cleanup cycle is due, running it");
    return true;
  }

  private async exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (this.runInFlight) {
      throw new ConflictError(
        "An inactivity cleanup run is already in progress",
      );
    }

    this.runInFlight = true;
    try {
      return await run();
    } finally {
      this.runInFlight = false;
    }
  }

  private async runRecordedCycle(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    await this.runCycle(triggeredBy);
    await settings.setInactivityCycleRanAt(new Date());
  }

  private async runCycle(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    try {
      await this.resolveReturned();
      await this.warnInactive();
      await this.removeExpired(triggeredBy);
      await this.pruneClosed();
    } catch (error) {
      logger.error("Error during inactivity cleanup cycle:", error);
      throw error;
    }
  }

  private async resolveReturned(): Promise<void> {
    const resolved = await Q.player.inactivity.warning.resolveReturned();
    for (const warning of resolved) {
      logger.info(
        `Resolved inactivity warning for ${warning.minecraftUsername} (logged in since warning)`,
      );
    }
    if (resolved.length > 0) {
      logger.info(
        `Resolved ${resolved.length} inactivity warning(s), players returned`,
      );
    }
  }

  private async warnInactive(): Promise<void> {
    const inactivePlayers =
      await Q.player.inactivity.warning.getInactivePlayers(
        INACTIVITY_INACTIVE_DAYS,
      );

    if (inactivePlayers.length === 0) {
      logger.debug("No new inactive players to warn");
      return;
    }

    logger.info(`Found ${inactivePlayers.length} inactive player(s) to warn`);

    const deadlineDate = new Date(
      Date.now() + INACTIVITY_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    await Q.player.inactivity.warning.createMany(
      inactivePlayers.map((player) => ({
        playerMinecraftUuid: player.minecraftUuid,
      })),
    );

    try {
      const embed = EmbedPresets.inactivity.warning({
        players: inactivePlayers,
        deadlineDate,
      });

      const message = await Discord.Messages.send({
        channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        embeds: embed.build(),
      });

      await Q.player.inactivity.warning.setMessageIdOnPending(message.id);

      logger.info(
        `Sent inactivity warning announcement (messageId: ${message.id}) for ${inactivePlayers.length} player(s)`,
      );
    } catch (error) {
      logger.error("Failed to send inactivity warning embed:", error);
    }
  }

  private async removeExpired(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    const expiredWarnings =
      await Q.player.inactivity.warning.getExpiredWarnings(
        INACTIVITY_GRACE_DAYS,
      );

    if (expiredWarnings.length === 0) {
      logger.debug("No expired inactivity warnings to process");
      return;
    }

    logger.info(
      `Found ${expiredWarnings.length} expired inactivity warning(s), removing players`,
    );

    const removedUsernames: string[] = [];

    for (const warning of expiredWarnings) {
      try {
        if (warning.lastSeen > warning.warnedAt) {
          await Q.player.inactivity.warning.update(
            { id: warning.id },
            { resolvedAt: new Date() },
          );
          logger.info(
            `Skipped removal of ${warning.minecraftUsername}: logged in since warning`,
          );
          continue;
        }

        await removeInactiveWarning(warning);
        removedUsernames.push(warning.minecraftUsername);
      } catch (error) {
        logger.error(
          `Failed to remove inactive player ${warning.minecraftUsername}:`,
          error,
        );
      }
    }

    if (removedUsernames.length > 0) {
      const removedAt = new Date();

      let messageService: DiscordMessageService | null = null;
      try {
        messageService = Discord.Messages;
      } catch (error) {
        logger.error(
          "Discord message service unavailable, skipping inactivity removal notifications:",
          error,
        );
      }

      if (messageService) {
        try {
          const embed = EmbedPresets.inactivity.removed({
            players: removedUsernames,
            removedAt,
          });

          await messageService.send({
            channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
            embeds: embed.build(),
          });

          logger.info(
            `Sent inactivity removal announcement for ${removedUsernames.length} player(s)`,
          );
        } catch (error) {
          logger.error(
            "Failed to send inactivity removal announcement:",
            error,
          );
        }

        try {
          const adminEmbed = EmbedPresets.inactivity.adminRemoval({
            players: removedUsernames,
            triggeredBy,
            removedAt,
          });

          await messageService.send({
            channelId: Discord.Channels.administration.NOTIFICATIONS,
            embeds: adminEmbed.build(),
          });
        } catch (error) {
          logger.error(
            "Failed to send inactivity removal admin notification:",
            error,
          );
        }
      }
    }
  }

  private async pruneClosed(): Promise<void> {
    const pruned = await Q.player.inactivity.warning.pruneClosed(
      INACTIVITY_RETENTION_DAYS,
    );

    if (pruned > 0) {
      logger.info(
        `Pruned ${pruned} inactivity warning(s) closed more than ${INACTIVITY_RETENTION_DAYS}d ago`,
      );
    }
  }

  private async resolveAndRemoveOnly(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    try {
      await this.resolveReturned();
      await this.removeExpired(triggeredBy);
      await this.pruneClosed();
    } catch (error) {
      logger.error("Error during resolve/remove cycle:", error);
      throw error;
    }
  }

  /** Run the full cycle (resolve, warn, remove) on demand. Does not reset the schedule. */
  async triggerManualCleanup(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info("Manual inactivity cleanup triggered");
    await this.exclusive(() => this.runCycle(triggeredBy));
  }

  /** Run resolve+remove on demand, skipping the warn phase, to process overdue players without posting duplicate warning announcements. */
  async triggerResolveAndRemove(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info("Manual inactivity resolve+remove triggered (no new warnings)");
    await this.exclusive(() => this.resolveAndRemoveOnly(triggeredBy));
  }

  /** Force-run the full cleanup cycle now and reset the schedule: the next automatic full cycle is due a week after this one finishes. */
  async forceRunAndResetSchedule(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info(
      "Forced inactivity cleanup triggered, resetting recurring schedule",
    );

    await this.exclusive(() => this.runRecordedCycle(triggeredBy));

    logger.info(
      `Inactivity cleanup schedule reset, next full cycle in ${INACTIVITY_CHECK_INTERVAL_MS / 86400000}d`,
    );
  }
}
