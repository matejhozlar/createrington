import { Q } from "@/db";
import { minecraftRcon } from "@/utils/rcon";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import type { Client } from "discord.js";
import type { PlayerBan } from "@createrington/shared/db";

/**
 * Player Ban Service
 *
 * Handles automatic unbanning of expired temporary bans:
 * - Periodically checks for expired bans every 5 minutes
 * - Updates database records with unban details
 * - Pardons players on Minecraft servers via RCON
 * - Sends Discord notifications to administration channel
 * - Logs all automatic unban actions for audit trail
 *
 * NOTE: This service runs automatically after initialization
 * and requires a Discord client for notifications
 */
export class PlayerBanService {
  private unbanCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000;

  constructor(private readonly discordClient: Client) {}

  /**
   * Initializes the service and starts the periodic unban checker
   *
   * This method:
   * - Performs an immediate check for expired bans
   * - Sets up a recurring interval to check every 5 minutes
   * - Logs initialization status
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * const banService = new PlayerBanService(discordClient);
   * await banService.initialize();
   * // Service is now running and will check every 5 minutes
   */
  async initialize(): Promise<void> {
    await this.checkExpiredBans();

    this.unbanCheckInterval = setInterval(() => {
      this.checkExpiredBans().catch((error) => {
        logger.error("Failed to check expired bans:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      "PlayerBanService initialized with auto-unban checker (checks every 5 minutes)",
    );
  }

  /**
   * Checks for expired temporary bans and processes them automatically
   *
   * For each expired ban found:
   * - Updates database to mark as unbanned
   * - Pardons player on Minecraft servers
   * - Creates admin log entry
   * - Sends Discord notification
   *
   * @returns Promise that resolves when all expired bans are processed
   *
   * @private
   */
  private async checkExpiredBans(): Promise<void> {
    try {
      const expiredBans = await Q.player.ban.getExpiredBans();

      if (expiredBans.length === 0) {
        return;
      }

      logger.info(`Found ${expiredBans.length} expired ban(s) to process`);

      for (const ban of expiredBans) {
        try {
          await this.processExpiredBan(ban);
        } catch (error) {
          logger.error(`Failed to auto-unban expired ban #${ban.id}:`, error);
        }
      }

      logger.info(`Processed ${expiredBans.length} expired ban(s)`);
    } catch (error) {
      logger.error("Failed to check for expired bans:", error);
      throw error;
    }
  }

  /**
   * Processes a single expired ban through the complete unban workflow
   *
   * Workflow steps:
   * 1. Fetch player information (handles deleted players gracefully)
   * 2. Update ban record in database
   * 3. Create admin action log entry
   * 4. Pardon player on all Minecraft servers via RCON
   * 5. Send Discord notification to administration channel
   *
   * @param ban - The expired ban record to process
   * @returns Promise that resolves when processing is complete
   *
   * @private
   */
  private async processExpiredBan(ban: PlayerBan): Promise<void> {
    let minecraftUsername = "Unknown";
    let wasDeleted = false;

    try {
      const player = await Q.player.find({
        minecraftUuid: ban.playerMinecraftUuid,
      });
      if (player) {
        minecraftUsername = player.minecraftUsername;
      }
    } catch {
      minecraftUsername =
        ban.metadata?.minecraftUsername || "Unknown (Deleted)";
      wasDeleted = true;
    }

    const updatedBan = await Q.player.ban.updateAndReturn(
      { id: ban.id },
      {
        unbanned: true,
        unbannedByDiscordId: "system",
        unbannedByUsername: "System",
        unbannedAt: new Date(),
        unbanReason: "Temporary ban expired",
      },
    );

    await Q.admin.log.action.create({
      adminDiscordId: "system",
      adminDiscordUsername: "System",
      actionType: "unban_player" as any,
      targetPlayerUuid: ban.playerMinecraftUuid,
      targetPlayerName: minecraftUsername,
      tableName: "player_ban",
      fieldName: "unbanned",
      oldValue: "false",
      newValue: "true",
      reason: "Temporary ban expired",
      serverId: ban.serverId || undefined,
      metadata: {
        banId: ban.id,
        originalBanType: ban.banType,
        originalReason: ban.reason,
        automatic: true,
      },
    });

    if (!wasDeleted && minecraftUsername !== "Unknown") {
      try {
        await minecraftRcon.pardonAll(minecraftUsername);
        logger.info(
          `Auto-pardoned ${minecraftUsername} on all Minecraft servers (ban #${ban.id})`,
        );
      } catch (error) {
        logger.error(
          `Failed to pardon ${minecraftUsername} on Minecraft servers:`,
          error,
        );
      }
    }

    try {
      await this.notifyAutoUnban(updatedBan, minecraftUsername, wasDeleted);
    } catch (error) {
      logger.error("Failed to send auto-unban notification:", error);
    }

    logger.info(`Auto-unbanned ban #${ban.id} for ${minecraftUsername}`);
  }

  /**
   * Sends Discord notification for an automatic unban
   *
   * Creates an embed with:
   * - Player information
   * - Original ban reason
   * - Ban timestamp
   * - Ban duration
   * - Warning if player data was deleted
   *
   * @param ban - The ban record that was processed
   * @param minecraftUsername - Player's Minecraft username
   * @param wasDeleted - Whether the player data was previously deleted
   * @returns Promise that resolves when notification is sent
   *
   * @private
   */
  private async notifyAutoUnban(
    ban: PlayerBan,
    minecraftUsername: string,
    wasDeleted: boolean,
  ): Promise<void> {
    const embed = EmbedPresets.plain({
      title: "✅ Player Auto-Unbanned (Expired)",
      description: [
        `**Player**: ${minecraftUsername}`,
        `**Original ban reason**: ${ban.reason}`,
        `**Banned at**: <t:${Math.floor(ban.bannedAt.getTime() / 1000)}:F>`,
        `**Ban duration**: ${this.calculateDuration(ban.bannedAt, ban.expiresAt!)}`,
        wasDeleted ? `\n⚠️ *Player data was previously deleted*` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      color: EmbedColors.Success,
    });

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.build(),
    });
  }

  /**
   * Calculates human-readable duration between two dates
   *
   * Formats as:
   * - "X day(s) and Y hour(s)" when days > 0 and hours > 0
   * - "X day(s)" when only days exist
   * - "X hour(s)" when only hours exist
   *
   * @param start - Start date
   * @param end - End date
   * @returns Formatted duration string
   *
   * @private
   *
   * @example
   * calculateDuration(new Date("2024-01-01"), new Date("2024-01-03"))
   * // Returns: "2 days"
   *
   * @example
   * calculateDuration(new Date("2024-01-01 00:00"), new Date("2024-01-01 05:00"))
   * // Returns: "5 hours"
   */
  private calculateDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );

    if (days > 0) {
      return hours > 0
        ? `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""}`
        : `${days} day${days !== 1 ? "s" : ""}`;
    }

    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  /**
   * Manually triggers an immediate check for expired bans
   *
   * Useful for:
   * - Testing the unban system
   * - Manual execution outside normal schedule
   * - Admin commands to force a check
   *
   * @returns Promise that resolves when check is complete
   *
   * @example
   * // Manual trigger from admin command
   * await banService.checkNow();
   * // All expired bans will be processed immediately
   */
  async checkNow(): Promise<void> {
    logger.info("Manual check for expired bans triggered");
    await this.checkExpiredBans();
  }

  /**
   * Gets current statistics about the auto-unban service
   *
   * Returns:
   * - Service running status
   * - Check interval in milliseconds
   * - Next scheduled check time
   * - Current count of expired bans pending processing
   *
   * @returns Promise resolving to service statistics
   *
   * @example
   * const stats = await banService.getStats();
   * console.log(`Service running: ${stats.isRunning}`);
   * console.log(`Expired bans: ${stats.expiredBansCount}`);
   * console.log(`Next check: ${stats.nextCheck}`);
   */
  async getStats(): Promise<{
    isRunning: boolean;
    checkInterval: number;
    nextCheck: string;
    expiredBansCount: number;
  }> {
    const expiredBans = await Q.player.ban.getExpiredBans();

    return {
      isRunning: this.unbanCheckInterval !== null,
      checkInterval: this.CHECK_INTERVAL,
      nextCheck: this.unbanCheckInterval
        ? new Date(Date.now() + this.CHECK_INTERVAL).toISOString()
        : "Not running",
      expiredBansCount: expiredBans.length,
    };
  }

  /**
   * Shuts down the service and stops the periodic unban checker
   *
   * Cleans up:
   * - Clears the check interval
   * - Resets internal state
   * - Logs shutdown status
   *
   * @returns Promise that resolves when shutdown is complete
   *
   * @example
   * // During application shutdown
   * await banService.shutdown();
   * // Service will no longer check for expired bans
   */
  async shutdown(): Promise<void> {
    if (this.unbanCheckInterval) {
      clearInterval(this.unbanCheckInterval);
      this.unbanCheckInterval = null;
    }
    logger.info("PlayerBanService shutdown");
  }
}
