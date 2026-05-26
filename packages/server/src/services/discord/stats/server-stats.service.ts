import type { ServerStats, ServerStatsConfig } from "./types";
import type { Client } from "discord.js";
import config from "@/config";
import { Q } from "@/db";

/**
 * Updates the Discord server-stats voice channels (members / bots / total).
 *
 * Members come from the player table (linked MC accounts), bots is a fixed
 * config value. Refresh runs at startup and on a periodic interval; concurrent
 * runs are skipped via an in-flight guard.
 */
export class ServerStatsService {
  private lastStats: ServerStats | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;

  constructor(
    private readonly client: Client,
    private readonly config: ServerStatsConfig,
  ) {}

  /**
   * Start the service: perform an initial update and arm the refresh interval.
   * No-op outside production.
   */
  async initialize(): Promise<void> {
    if (!config.envMode.isProd) {
      logger.info("ServerStatsService skipped (not production)");
      return;
    }

    logger.info("Initializing ServerStatsService...");
    await this.updateStats();
    this.startRefreshInterval();
    logger.info("ServerStatsService initialized");
  }

  /** Stop the refresh interval. Safe to call multiple times. */
  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    logger.info("ServerStatsService stopped");
  }

  /**
   * Trigger an immediate stats refresh outside the normal interval.
   * Skipped if another update is already in flight.
   */
  async forceUpdate(): Promise<void> {
    await this.updateStats();
  }

  /** Last published stats, or null if no update has succeeded yet. */
  getCurrentStats(): ServerStats | null {
    return this.lastStats;
  }

  private startRefreshInterval(): void {
    this.refreshTimer = setInterval(() => {
      void this.updateStats();
    }, this.config.refreshIntervalMs);
  }

  private async fetchStats(): Promise<ServerStats> {
    const members = await Q.player.count();
    const bots = this.config.botCount;

    return {
      members,
      bots,
      total: members + bots,
    };
  }

  private hasStatsChanged(newStats: ServerStats): boolean {
    if (!this.lastStats) {
      return true;
    }

    return (
      newStats.members !== this.lastStats.members ||
      newStats.bots !== this.lastStats.bots ||
      newStats.total !== this.lastStats.total
    );
  }

  private async updateStats(): Promise<void> {
    if (this.isUpdating) {
      logger.debug("Server stats update already in flight, skipping");
      return;
    }

    this.isUpdating = true;
    try {
      const stats = await this.fetchStats();

      if (!this.hasStatsChanged(stats)) {
        logger.debug("Server stats unchanged, skipping update");
        return;
      }

      const guild = await this.client.guilds.fetch(this.config.guildId);

      if (this.config.membersChannelId) {
        const membersChannel = guild.channels.cache.get(
          this.config.membersChannelId,
        );
        if (membersChannel) {
          await membersChannel.setName(`Members: ${stats.members}`);
        } else {
          logger.warn(
            `Members channel ${this.config.membersChannelId} not found`,
          );
        }
      }

      if (this.config.botsChannelId) {
        const botsChannel = guild.channels.cache.get(this.config.botsChannelId);
        if (botsChannel) {
          await botsChannel.setName(`Bots: ${stats.bots}`);
        } else {
          logger.warn(`Bots channel ${this.config.botsChannelId} not found`);
        }
      }

      if (this.config.totalMembersChannelId) {
        const totalChannel = guild.channels.cache.get(
          this.config.totalMembersChannelId,
        );
        if (totalChannel) {
          await totalChannel.setName(`All Members: ${stats.total}`);
        } else {
          logger.warn(
            `All Members channel ${this.config.totalMembersChannelId} not found`,
          );
        }
      }

      this.lastStats = stats;
      logger.info(
        `Server stats updated - Members: ${stats.members}, Bots: ${stats.bots}, Total: ${stats.total}`,
      );
    } catch (error) {
      logger.error("Failed to update server stats:", error);
    } finally {
      this.isUpdating = false;
    }
  }
}
