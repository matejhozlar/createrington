import { Q } from "@/db";
import { getLeaderboardConfig } from "./config";
import { type LeaderboardRefreshResult, LeaderboardType } from "./types";
import { Discord } from "@/discord/constants";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
} from "discord.js";
import { EmbedPresets } from "@/discord/embeds";

/**
 * Service for managing Discord leaderboards
 *
 * Handles:
 * - Creating leaderboard messages
 * - Refreshing leaderboard data
 * - Managing persistent leaderboard messages in database
 */
export class LeaderboardService {
  private refreshInterval?: NodeJS.Timeout;
  private readonly REFRESH_INTERVAL = 60 * 60 * 1000;
  constructor(private readonly bot: Client) {}

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize the service and start automatic refresh scheduler
   * Called by the service container during startup
   *
   * @returns Promise resolving when the service is initialized
   */
  async initialize(): Promise<void> {
    logger.info("Initializing LeaderboardService...");

    logger.info("Running initial leaderboard refresh");
    await this.refreshAll();

    this.refreshInterval = setInterval(async () => {
      logger.info("Running scheduled leaderboard refresh");
      await this.refreshAll();
    }, this.REFRESH_INTERVAL);

    logger.info("LeaderboardService initialized");
  }

  /**
   * Shutdown the service and cleanup timers
   * Called by the service container during graceful shutdown
   *
   * @returns Promise resolving when the service is shut down
   */
  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      logger.info("LeaderboardService refresh scheduler stopped");
    }
  }

  // ==========================================================================
  // LEADERBOARD MANAGEMENT
  // ==========================================================================

  /**
   * Creates a new leaderboard message or updates an existing one
   *
   * If a leaderboard message already exists in the database for this type,
   * it will be updated. Otherwise, a new message will be created and sent
   * to the configured channel
   *
   * @param type - The type of leaderboard to create or update
   * @returns Promise resolving to the message ID and channel ID
   * @throws Error if message creation fails
   */
  async createOrUpdate(
    type: LeaderboardType,
  ): Promise<{ messageId: string; channelId: string }> {
    const config = getLeaderboardConfig(type);

    const entries = await config.fetchData(config.serverId, 10);

    const embed = EmbedPresets.leaderboard.display(type, entries);

    const buttons = this.buildLeaderboardButtons(type);

    const existing = await Q.leaderboard.message.find({
      leaderboardType: type,
    });

    if (existing) {
      await Discord.Messages.edit({
        channelId: existing.channelId,
        messageId: existing.messageId,
        embeds: embed.build(),
        components: buttons,
      });

      await Q.leaderboard.message.update(
        { id: existing.id },
        { lastRefreshed: new Date() },
      );

      logger.info(`Updated ${type} leaderboard message ${existing.messageId}`);

      return {
        messageId: existing.messageId,
        channelId: existing.channelId,
      };
    } else {
      const result = await Discord.Messages.send({
        channelId: config.channelId,
        embeds: embed.build(),
        components: buttons,
      });

      if (!result.success || !result.messageId) {
        throw new Error(`Failed to create ${type} leaderboard message`);
      }

      await Q.leaderboard.message.create({
        leaderboardType: type,
        channelId: config.channelId,
        messageId: result.messageId,
      });

      logger.info(`Created ${type} leaderboard message ${result.messageId}`);

      return {
        messageId: result.messageId,
        channelId: config.channelId,
      };
    }
  }

  /**
   * Refreshes a leaderboard with fresh data
   *
   * Fetches new leaderboard data and updates the existing message
   * If this is a manual refresh, it updates the manual refresh timestamp
   * which is used for cooldown tracking. Automatic refreshes only update
   * the display timestamp
   *
   * @param type - The type of leaderboard to refresh
   * @param isManual - Whether this is a manual user refresh (default: false)
   * @returns Promise resolving to refresh result with success status and entries
   */
  async refresh(
    type: LeaderboardType,
    isManual: boolean = false,
  ): Promise<LeaderboardRefreshResult> {
    try {
      const config = getLeaderboardConfig(type);

      const entries = await config.fetchData(config.serverId, 10);

      const existing = await Q.leaderboard.message.find({
        leaderboardType: type,
      });

      if (!existing) {
        logger.warn(`No leaderboard message found for type: ${type}, skipping refresh`);
        return {
          success: false,
          type,
          entries: [],
          error: `No leaderboard message found for type: ${type}`,
        };
      }

      const embed = EmbedPresets.leaderboard.display(type, entries);
      const buttons = this.buildLeaderboardButtons(type);

      await Discord.Messages.edit({
        channelId: existing.channelId,
        messageId: existing.messageId,
        embeds: embed.build(),
        components: buttons,
      });

      const updates: {
        lastRefreshed: Date;
        lastManualRefresh?: Date;
      } = {
        lastRefreshed: new Date(),
      };

      if (isManual) {
        updates.lastManualRefresh = new Date();
      }

      await Q.leaderboard.message.update({ id: existing.id }, updates);

      logger.info(
        `Refreshed ${type} leaderboard (${isManual ? "manual" : "automatic"})`,
      );

      return {
        success: true,
        type,
        entries,
      };
    } catch (error) {
      logger.error(`Failed to refresh ${type} leaderboard:`, error);
      return {
        success: false,
        type,
        entries: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Refreshes all leaderboards
   *
   * Iterates through all leaderboard types and refreshes each one
   * This is typically called by the automatic refresh scheduler
   * All refreshes are marked as automatic (not manual) and don't
   * trigger cooldowns
   *
   * @returns Promise resolving to an array of refresh results for all leaderboards
   */
  async refreshAll(): Promise<LeaderboardRefreshResult[]> {
    const types = Object.values(LeaderboardType);
    const results = await Promise.all(types.map((type) => this.refresh(type)));

    const successful = results.filter((r) => r.success).length;
    logger.info(`Refreshed ${successful}/${results.length} leaderboards`);

    return results;
  }

  // ==========================================================================
  // COOLDOWN
  // ==========================================================================

  /**
   * Checks if a leaderboard can be manually refreshed
   *
   * Manual refreshes have a 1-hour cooldown to prevent spam
   * This checks the last manual refresh timestamp (not automatic refreshes)
   * and determines if enough time has elapsed
   *
   * @param type - The type of leaderboard to check
   * @returns Promise resolving to cooldown status with remaining time if applicable
   */
  async canRefresh(type: LeaderboardType): Promise<{
    canRefresh: boolean;
    remainingSeconds?: number;
    lastRefreshed?: Date;
  }> {
    const existing = await Q.leaderboard.message.find({
      leaderboardType: type,
    });

    if (!existing || !existing.lastManualRefresh) {
      return { canRefresh: true };
    }

    const now = Date.now();
    const lastRefresh = existing.lastManualRefresh.getTime();
    const cooldownMs = 60 * 60 * 1000;
    const elapsed = now - lastRefresh;

    if (elapsed >= cooldownMs) {
      return {
        canRefresh: true,
        lastRefreshed: existing.lastManualRefresh,
      };
    }

    const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);

    return {
      canRefresh: false,
      remainingSeconds,
      lastRefreshed: existing?.lastManualRefresh,
    };
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Builds the button components for a leaderboard message
   *
   * Creates a refresh button that users can click to manually refresh
   * the leaderboard data. The button includes the leaderboard type in
   * its custom ID for routing
   *
   * @param type - The type of leaderboard to build buttons for
   * @returns Array of action rows containing the button components
   *
   * @private
   */
  private buildLeaderboardButtons(
    type: LeaderboardType,
  ): ActionRowBuilder<ButtonBuilder>[] {
    const refreshButton = new ButtonBuilder()
      .setCustomId(`leaderboard:refresh:${type}`)
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary);

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton)];
  }
}
