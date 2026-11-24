import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { playerDeletionService } from "@/services/player/deletion";
import {
  cancelDeparture,
  checkDeparture,
} from "@/services/discord/cleanup/member/departure";

/**
 * Sweeps player data for Discord members who left more than 30 days ago.
 * Runs an immediate pass on init, then repeats every 6 hours. Each expired
 * row is re-checked first: a member back in the guild, or a player now
 * registered to another Discord account, cancels the row instead; a failed
 * Discord lookup skips it until the next pass. Otherwise it deletes the
 * player record, removes the player from every
 * Minecraft whitelist via RCON, stamps the departed_member row as deleted,
 * and updates the original administration notification embed. RCON failures
 * during whitelist removal are logged but do not abort the rest of the
 * cleanup for that member.
 */
export class MemberCleanupService {
  private intervalId?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 6 * 60 * 60 * 1000;

  /** Run an immediate cleanup pass and arm the 6-hour interval. */
  initialize(): void {
    logger.info("Initializing MemberCleanupService...");

    this.cleanup().catch((error) => {
      logger.error("Initial member cleanup failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error("Scheduled member cleanup failed:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(`MemberCleanupService initialized`);
  }

  /** Clear the scheduled interval. Safe to call multiple times. */
  shutdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("MemberCleanupService stopped");
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const expiredMembers = await Q.discord.guild.member.leave.getExpired();

      if (expiredMembers.length === 0) {
        logger.debug("No departed members to clean up");
        return;
      }

      logger.info(
        `Found ${expiredMembers.length} departed member(s) ready for auto-deletion`,
      );

      for (const member of expiredMembers) {
        try {
          const check = await checkDeparture(member);

          if (check.action === "unavailable") {
            logger.warn(
              `Skipping auto-deletion of ${member.minecraftUsername}: could not confirm they are still gone from Discord`,
            );
            continue;
          }

          if (check.action === "cancel") {
            await cancelDeparture(member, check.reason);
            continue;
          }

          await playerDeletionService.delete(
            { minecraftUuid: member.minecraftUuid },
            {
              actor: { type: "system" },
              reason: "Departed Discord 30+ days ago",
              ignoreMissing: true,
            },
          );

          await Q.discord.guild.member.leave.update(
            { id: member.id },
            { deletedAt: new Date() },
          );

          if (member.notificationMessageId) {
            try {
              const autoDeleted = EmbedPresets.departed.autoDeleted({
                minecraftUsername: member.minecraftUsername,
                departedAt: member.departedAt,
                deletedAt: new Date(),
              });

              await Discord.Messages.edit({
                channelId: Discord.Channels.administration.NOTIFICATIONS,
                messageId: member.notificationMessageId,
                embeds: autoDeleted.build(),
                components: null,
              });
            } catch (error) {
              logger.warn(
                `Could not update notification message for ${member.minecraftUsername}:`,
                error,
              );
            }
          }

          logger.info(
            `Auto-deleted departed member ${member.minecraftUsername} (departed ${member.departedAt.toISOString()})`,
          );
        } catch (error) {
          logger.error(
            `Failed to auto-delete ${member.minecraftUsername}:`,
            error,
          );
        }
      }
    } catch (error) {
      logger.error("Error during departed member cleanup:", error);
      throw error;
    }
  }

  /** Run the cleanup pass on demand without waiting for the scheduled interval. */
  async triggerManualCleanup(): Promise<void> {
    logger.info("Manual cleanup triggered");
    await this.cleanup();
  }
}
