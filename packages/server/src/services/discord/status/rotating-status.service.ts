import { ActivityType, Client } from "discord.js";
import { type StatusCategory, type StatusConfig, statusConfigs } from "./types";

/**
 * Rotating Status Service
 *
 * Manages the web bot's Discord presence by cycling through a configured list of statuses:
 * - Rotates statuses on a fixed interval (default: 60 seconds)
 * - Supports dynamic status text resolved at rotation time (e.g. live player counts)
 * - Falls back to static text if the dynamic resolver throws
 * - Exposes controls to add, filter, and reset the active status pool
 *
 * NOTE: Waits for the Discord client to reach the ready state before starting rotation
 */
export class RotatingStatusService {
  private statuses: StatusConfig[];
  private currentIndex: number = 0;
  private intervalId?: NodeJS.Timeout;

  /**
   * Creates a new rotating status service
   *
   * @param client - The Discord client instance (web bot)
   * @param rotatingInterval - Interval between status changes in milliseconds (default: 60000)
   */
  constructor(
    private readonly client: Client,
    private readonly rotatingInterval: number = 60000,
  ) {
    this.statuses = statusConfigs;
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize the service and start status rotation
   * Called by the service container during startup
   *
   * Sets an initial status immediately, then rotates at the configured interval
   *
   * @returns Promise resolving when the service initialization is completed
   */
  async initialize(): Promise<void> {
    // Uncomment if you want to skip in non-production:
    // if (!config.envMode.isProd) {
    //   logger.warn("Skipping rotating statuses in non-production environment");
    //   return;
    // }

    if (!this.client.isReady()) {
      logger.warn("Client not ready yet, waiting for ready state");
      await new Promise<void>((resolve) => {
        this.client.once("clientReady", () => resolve());
      });
    }
    logger.info("Initializing RotatingStatusService...");

    await this.rotateStatus();

    this.intervalId = setInterval(() => {
      this.rotateStatus().catch((error) => {
        logger.error("Error during status rotation:", error);
      });
    }, this.rotatingInterval);

    logger.info(
      `RotatingStatusService initialized (${this.statuses.length} statuses, ${this.rotatingInterval / 1000}s interval)`,
    );
  }

  /**
   * Shutdown the service and clean up timers
   * Called by the service container during graceful shutdown
   *
   * @returns Promise resolving when the service is stopped
   */
  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("RotatingStatusService stopped");
    }
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Rotates to the next status
   * Handles both static and dynamic statuses
   *
   * @returns Promise resolving when the status is rotated
   * @private
   */
  private async rotateStatus(): Promise<void> {
    const statusConfig = this.statuses[this.currentIndex];

    try {
      const statusText = statusConfig.dynamic
        ? await statusConfig.dynamic()
        : statusConfig.text;

      this.setStatus(statusText);

      this.currentIndex = (this.currentIndex + 1) % this.statuses.length;
    } catch (error) {
      logger.error("Error rotating status:", error);
      this.setStatus(statusConfig.text);
    }
  }

  /**
   * Sets the bot's custom status
   *
   * @param status - The status text to display
   *
   * @private
   */
  private setStatus(status: string): void {
    if (!this.client.isReady()) {
      logger.warn("Cannot set status - client not ready");
      return;
    }

    this.client.user.setPresence({
      activities: [
        {
          type: ActivityType.Custom,
          name: "custom",
          state: status,
        },
      ],
      status: "online",
    });

    logger.debug(`Set bot status to: "${status}"`);
  }

  // ==========================================================================
  // CONTROLS
  // ==========================================================================

  /**
   * Manually triggers a status rotation
   *
   * Useful for testing or forcing an immediate update outside the scheduled interval.
   *
   * @returns Promise resolving when the rotation is complete
   */
  async forceRotation(): Promise<void> {
    await this.rotateStatus();
  }

  /**
   * Adds a new status to the rotation
   *
   * @param status - Status configuration to add
   */
  addStatus(status: StatusConfig): void {
    this.statuses.push(status);
    logger.debug(`Added new status: ${status.text}`);
  }

  /**
   * Filters statuses by category
   *
   * @param category - Category to filter by
   */
  filterCategory(category: StatusCategory): void {
    this.statuses = statusConfigs.filter((s) => s.category === category);
    this.currentIndex = 0;
    logger.info(`Filtered statuses to category: ${category}`);
  }

  /**
   * Resets statuses to default configuration
   */
  resetStatuses(): void {
    this.statuses = statusConfigs;
    this.currentIndex = 0;
    logger.info("Reset statuses to default configuration");
  }

  /**
   * Gets statistics about the status rotation
   *
   * @returns Object containing total count, current index, and count by category
   */
  getStats(): {
    total: number;
    currentIndex: number;
    byCategory: Record<StatusCategory, number>;
  } {
    const byCategory = this.statuses.reduce(
      (acc, status) => {
        acc[status.category] = (acc[status.category] || 0) + 1;
        return acc;
      },
      {} as Record<StatusCategory, number>,
    );

    return {
      total: this.statuses.length,
      currentIndex: this.currentIndex,
      byCategory,
    };
  }
}
