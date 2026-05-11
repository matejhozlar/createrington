import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { removeInactiveWarning } from "./remove-warning";

/**
 * Who triggered a cleanup run. `null` means the scheduled tick or the
 * startup sweep. The admin-notification embed renders it as "Automated".
 */
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
 * All state is persisted in the `player_inactivity_warning` table, making
 * the system fully restart/redeploy-safe.
 */
export class InactivityCleanupService {
  private intervalId?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly INACTIVE_DAYS = 60;
  private readonly GRACE_DAYS = 14;

  async initialize(): Promise<void> {
    logger.info("Initializing InactivityCleanupService...");

    // Run resolve/remove on startup (safe and idempotent), but skip
    // sending new warnings to avoid duplicate announcements on frequent deploys.
    this.resolveAndRemoveOnly().catch((error) => {
      logger.error("Initial inactivity resolve/remove failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.runCycle().catch((error) => {
        logger.error("Scheduled inactivity cleanup cycle failed:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      `InactivityCleanupService initialized (check every ${this.CHECK_INTERVAL / 86400000}d, inactive threshold: ${this.INACTIVE_DAYS}d, grace period: ${this.GRACE_DAYS}d)`,
    );
  }

  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("InactivityCleanupService stopped");
    }
  }

  /**
   * Run the full cleanup cycle: resolve → warn → remove.
   * Order matters: resolve first so players who just returned aren't
   * accidentally included in the removal phase.
   */
  private async runCycle(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    try {
      await this.resolveReturned();
      await this.warnInactive();
      await this.removeExpired(triggeredBy);
    } catch (error) {
      logger.error("Error during inactivity cleanup cycle:", error);
      throw error;
    }
  }

  /**
   * Check active warnings and resolve any where the player has logged in
   * since being warned (lastSeen > warnedAt).
   */
  private async resolveReturned(): Promise<void> {
    const activeWarnings =
      await Q.player.inactivity.warning.findActiveWarnings();

    let resolvedCount = 0;

    for (const warning of activeWarnings) {
      if (warning.lastSeen > warning.warnedAt) {
        await Q.player.inactivity.warning.resolveWarning(warning.id);
        resolvedCount++;
        logger.info(
          `Resolved inactivity warning for ${warning.minecraftUsername} (logged in since warning)`,
        );
      }
    }

    if (resolvedCount > 0) {
      logger.info(
        `Resolved ${resolvedCount} inactivity warning(s), players returned`,
      );
    }
  }

  /**
   * Find newly inactive players (no active warning yet) and issue warnings.
   * Sends a single announcement embed mentioning all warned players.
   */
  private async warnInactive(): Promise<void> {
    const inactivePlayers =
      await Q.player.inactivity.warning.findInactivePlayers(this.INACTIVE_DAYS);

    if (inactivePlayers.length === 0) {
      logger.debug("No new inactive players to warn");
      return;
    }

    logger.info(`Found ${inactivePlayers.length} inactive player(s) to warn`);

    const deadlineDate = new Date(
      Date.now() + this.GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const player of inactivePlayers) {
      await Q.player.inactivity.warning.create({
        playerMinecraftUuid: player.minecraftUuid,
      });
    }

    try {
      const embed = EmbedPresets.inactivity.warning({
        players: inactivePlayers,
        deadlineDate,
      });

      const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
      const messageService = DiscordMessageService.getInstance(mainBot);

      const result = await messageService.send({
        channelId: Discord.Channels.createringtonOfficial.ANNOUNCEMENTS,
        embeds: embed.build(),
      });

      if (result.success && result.messageId) {
        // Store message ID on all warning records from this batch
        await Q.player.inactivity.warning.setMessageIdOnPending(
          result.messageId,
        );

        logger.info(
          `Sent inactivity warning announcement (messageId: ${result.messageId}) for ${inactivePlayers.length} player(s)`,
        );
      } else {
        logger.warn(
          `Failed to send inactivity warning announcement: ${result.error ?? "unknown error"}`,
        );
      }
    } catch (error) {
      logger.error("Failed to send inactivity warning embed:", error);
    }
  }

  /**
   * Remove players whose grace period has expired without them returning.
   * Kicks from Discord, removes from whitelist, deletes player record.
   */
  private async removeExpired(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    const expiredWarnings =
      await Q.player.inactivity.warning.findExpiredWarnings(this.GRACE_DAYS);

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
        // Double-check the player hasn't logged in since (defensive)
        if (warning.lastSeen > warning.warnedAt) {
          await Q.player.inactivity.warning.resolveWarning(warning.id);
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
        const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
        messageService = DiscordMessageService.getInstance(mainBot);
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

  /**
   * Run only the resolve and remove phases (no new warnings).
   * Used on startup to handle expired grace periods without sending
   * duplicate warning announcements on frequent deploys, and from the
   * admin panel when admins want to process overdue players without
   * triggering new warning announcements in #announcements.
   */
  async resolveAndRemoveOnly(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    try {
      await this.resolveReturned();
      await this.removeExpired(triggeredBy);
    } catch (error) {
      logger.error("Error during resolve/remove cycle:", error);
      throw error;
    }
  }

  async triggerManualCleanup(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info("Manual inactivity cleanup triggered");
    await this.runCycle(triggeredBy);
  }

  async triggerResolveAndRemove(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info("Manual inactivity resolve+remove triggered (no new warnings)");
    await this.resolveAndRemoveOnly(triggeredBy);
  }

  /**
   * Force-run the full cleanup cycle now and reset the recurring schedule.
   * The next automatic run will happen CHECK_INTERVAL from this call's
   * completion, not from the previously-scheduled tick.
   *
   * Used by the owner-only /force-inactivity-cleanup command.
   */
  async forceRunAndResetSchedule(
    triggeredBy: InactivityTriggerContext = null,
  ): Promise<void> {
    logger.info(
      "Forced inactivity cleanup triggered, resetting recurring schedule",
    );

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    try {
      await this.runCycle(triggeredBy);
    } finally {
      this.intervalId = setInterval(() => {
        this.runCycle().catch((error) => {
          logger.error("Scheduled inactivity cleanup cycle failed:", error);
        });
      }, this.CHECK_INTERVAL);

      logger.info(
        `Inactivity cleanup schedule reset, next run in ${this.CHECK_INTERVAL / 86400000}d`,
      );
    }
  }
}
