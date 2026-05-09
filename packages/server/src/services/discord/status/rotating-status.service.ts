import { ActivityType, Client } from "discord.js";

import config from "@/config";

import { MAX_STATUS_LENGTH, type StatusConfig } from "./types";

/**
 * Rotating Status Service
 *
 * Cycles a Discord client's custom-status presence through a configured pool
 * of statuses, resolving dynamic ones at rotation time and falling back to
 * each entry's static text on error.
 *
 * Output is hard-clamped to MAX_STATUS_LENGTH so a runaway dynamic resolver
 * cannot exceed Discord's 128-character cap.
 */
export class RotatingStatusService {
  private currentIndex: number = 0;
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly client: Client,
    private readonly statuses: StatusConfig[],
    private readonly rotatingInterval: number = 60000,
  ) {}

  async initialize(): Promise<void> {
    if (config.envMode.isDev) {
      logger.warn("Skipping rotating statuses in development environment");
      return;
    }

    if (this.statuses.length === 0) {
      logger.warn("RotatingStatusService has no statuses configured, skipping");
      return;
    }

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

  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("RotatingStatusService stopped");
    }
  }

  private async rotateStatus(): Promise<void> {
    const statusConfig = this.statuses[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.statuses.length;

    try {
      const resolved = statusConfig.dynamic
        ? await statusConfig.dynamic()
        : statusConfig.text;
      this.setStatus(resolved ?? statusConfig.text);
    } catch (error) {
      logger.error("Error rotating status:", error);
      this.setStatus(statusConfig.text);
    }
  }

  private setStatus(status: string): void {
    if (!this.client.isReady()) {
      logger.warn("Cannot set status - client not ready");
      return;
    }

    const clamped =
      status.length > MAX_STATUS_LENGTH
        ? `${status.slice(0, MAX_STATUS_LENGTH - 1)}…`
        : status;

    this.client.user.setPresence({
      activities: [
        {
          type: ActivityType.Custom,
          name: "custom",
          state: clamped,
        },
      ],
      status: "online",
    });

    logger.debug(`Set bot status to: "${clamped}"`);
  }

  async forceRotation(): Promise<void> {
    await this.rotateStatus();
  }
}
