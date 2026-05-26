import type { ServerStats, ServerStatsConfig } from "./types";
import type { Client } from "discord.js";
import config from "@/config";
import { Q } from "@/db";

/**
 * Service for updating Discord server statistics in channel names.
 *
 * Members come from the player table (linked MC accounts), bots are a fixed
 * config value. Refresh runs at startup, on Discord member join/leave, and on
 * a periodic interval as a self-healer.
 */
export class ServerStatsService {
  private lastStats: ServerStats | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly client: Client,
    private readonly config: ServerStatsConfig,
  ) {}

  async initialize(): Promise<void> {
    if (!config.envMode.isProd) {
      logger.info("ServerStatsService skipped (not production)");
      return;
    }

    logger.info("Initializing ServerStatsService...");
    await this.updateStats();
    this.setupEventListeners();
    this.startRefreshInterval();
    logger.info("ServerStatsService initialized");
  }

  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    logger.info("ServerStatsService stopped");
  }

  private setupEventListeners(): void {
    this.client.on("guildMemberAdd", async () => {
      await this.updateStats();
    });

    this.client.on("guildMemberRemove", async () => {
      await this.updateStats();
    });

    logger.debug("ServerStatsService event listeners registered");
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
    }
  }

  async forceUpdate(): Promise<void> {
    await this.updateStats();
  }

  getCurrentStats(): ServerStats | null {
    return this.lastStats;
  }
}
