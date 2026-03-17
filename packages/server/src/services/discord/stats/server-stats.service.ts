import type { ServerStats, ServerStatsConfig } from "./types";
import type { Client } from "discord.js";
import config from "@/config";

/**
 * Service for updating Discord server statistics in channel names
 *
 * Features:
 * - Updates channel names with member counts on member join/leave events
 * - Tracks members, bots, and total separately
 * - Only updates when counts change to minimize API calls
 * - Event-driven updates (no polling intervals)
 * - Graceful error handling and logging
 */
export class ServerStatsService {
  private lastStats: ServerStats | null = null;

  constructor(
    private readonly client: Client,
    private readonly config: ServerStatsConfig,
  ) {}

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize the service and start stat tracking
   * Called by the service container during startup
   *
   * - Performs initial member fetch to populate cache
   * - Performs initial stats update
   * - Sets up event listeners for member changes
   *
   * @returns Promise resolving when the initialization is completed
   */
  async initialize(): Promise<void> {
    if (!config.envMode.isProd) {
      logger.info("ServerStatsService skipped (not production)");
      return;
    }

    logger.info("Initializing ServerStatsService...");
    await this.ensureMembersFetched();
    await this.updateStats();
    this.setupEventListeners();
    logger.info("ServerStatsService initialized");
  }

  /**
   * Shutdown the service
   * Called by the service container during graceful shutdown
   *
   * Note: Event listeners are tied to the client and will be cleaned up
   * when the client is destroyed, no cleanup needed here
   */
  async shutdown(): Promise<void> {
    logger.info("ServerStatsService stopped");
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Ensures guild members are fetched and cached
   *
   * @returns Promise resolving when the cache is ensured
   * @private
   */
  private async ensureMembersFetched(): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.config.guildId);

      logger.info("Fetching all guild members for stats service...");
      await guild.members.fetch();

      const memberCount = guild.members.cache.size;
      logger.info(`Cached ${memberCount} guild members`);
    } catch (error) {
      logger.error("Failed to fetch guild members:", error);
      throw error;
    }
  }

  /**
   * Sets up event listeners for member join/leave
   *
   * @private
   */
  private setupEventListeners(): void {
    this.client.on("guildMemberAdd", async (member) => {
      logger.debug(`Member joined: ${member.user.tag}, updating stats`);
      await this.updateStats();
    });

    this.client.on("guildMemberRemove", async (member) => {
      logger.debug(`Member left: ${member.user.tag}, updating stats`);
      await this.updateStats();
    });

    logger.debug("ServerStatsService event listeners registered");
  }

  /**
   * Fetches current server statistics
   *
   * @returns Promise resolving to current stats
   */
  private async fetchStats(): Promise<ServerStats> {
    const guild = await this.client.guilds.fetch(this.config.guildId);

    const members = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const total = members + bots;

    if (total === 0) {
      logger.warn("Member cache is empty - this may indicate a caching issue");
    }

    return {
      members,
      bots,
      total,
    };
  }

  /**
   * Checks if stats have changed since last update
   *
   * @param newStats - New statistics to compare
   * @returns True if stats have changed, false otherwise
   *
   * @private
   */
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

  /**
   * Updates channel names with current statistics
   *
   * Only updates if stats have changed since last update to minimize API calls
   *
   * @returns Promise resolving when the stats are updated
   * @private
   */
  private async updateStats(): Promise<void> {
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
          logger.debug(`Updated members channel: ${stats.members}`);
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
          logger.debug(`Updated bots channel: ${stats.bots}`);
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
          logger.debug(`Updated total channel: ${stats.total}`);
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
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Manually triggers a stats update
   *
   * Useful for testing or forcing an immediate update
   *
   * @returns Promise resolving when the update is completed
   */
  async forceUpdate(): Promise<void> {
    await this.updateStats();
  }

  /**
   * Get the current cached stats
   *
   * @returns Current cached stats or null if not yet fetched
   */
  getCurrentStats(): ServerStats | null {
    return this.lastStats;
  }
}
