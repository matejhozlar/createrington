import { Q } from "@/db";
import { NotFoundError } from "@/db/utils/errors";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";

/**
 * Member Cleanup Service
 *
 * Automatically removes player data for Discord members who departed more than 30 days ago:
 * - Runs an immediate cleanup on startup, then repeats every 6 hours
 * - Deletes the player record from the database
 * - Removes the player from all Minecraft server whitelists via RCON
 * - Marks the departed_member row as deleted with a timestamp
 * - Updates the associated Discord administration notification embed
 *
 * NOTE: RCON failures during whitelist removal are logged but do not
 * abort the rest of the cleanup for that member
 */
export class MemberCleanupService {
  private intervalId?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Initialize the service and start automatic cleanup scheduler
   * Called by the service container during startup
   *
   * @returns Promise resolving when the service is started
   */
  async initialize(): Promise<void> {
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

  /**
   * Shutdown the service and clean up timers
   * Called by the service container during graceful shutdown
   *
   * @returns Promise resolving when the service is shut down
   */
  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("MemberCleanupService stopped");
    }
  }

  /**
   * Performs a cleanup of departed members older than 30 days
   *
   * For each expired member:
   * 1. Deletes player data from database
   * 2. Removes from Minecraft server whitelist
   * 3. Marks as deleted in departed_members table
   * 4. Updates notification message if it exists
   *
   * @returns Promise resolving when the cleanup is finished
   * @private
   */
  private async cleanup(): Promise<void> {
    try {
      const expiredMembers = await Q.discord.guild.member.leave.expired();

      if (expiredMembers.length === 0) {
        logger.debug("No departed members to clean up");
        return;
      }

      logger.info(
        `Found ${expiredMembers.length} departed member(s) ready for auto-deletion`,
      );

      for (const member of expiredMembers) {
        try {
          try {
            await Q.player.delete({ minecraftUuid: member.minecraftUuid });
          } catch (error) {
            if (!(error instanceof NotFoundError)) throw error;
          }

          try {
            await minecraftRcon.whitelistAll(
              WhitelistAction.REMOVE,
              member.minecraftUsername,
            );
          } catch (error) {
            logger.error(
              `Failed to remove ${member.minecraftUsername} from whitelist:`,
              error,
            );
          }

          await Q.discord.guild.member.leave.update(member, {
            deletedAt: new Date(),
          });

          if (member.notificationMessageId) {
            try {
              const result = await Discord.Messages.fetchMessage({
                channelId: Discord.Channels.administration.NOTIFICATIONS,
                messageId: member.notificationMessageId,
              });

              if (result.success) {
                const autoDeleted = EmbedPresets.departed.autoDeleted({
                  minecraftUsername: member.minecraftUsername,
                  departedAt: member.departedAt,
                  deletedAt: new Date(),
                });

                await result.message.edit({
                  embeds: [autoDeleted.build()],
                  components: [],
                });
              }
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

  /**
   * Manually triggers cleanup
   *
   * Useful for admin commands or testing to force an immediate cleanup
   * without waiting for the scheduled interval
   *
   * @returns Promise resolving when the cleanup is complete
   */
  async triggerManualCleanup(): Promise<void> {
    logger.info("Manual cleanup triggered");
    await this.cleanup();
  }
}
