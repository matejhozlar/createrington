import { Q } from "@/db";
import type { DiscordMessageService } from "../message/message.service";
import type { DiscordAutoMessageConfig } from "@createrington/shared/db/discord_auto_message_config.types";

/**
 * Auto-Message Service
 *
 * Manages scheduled, rotating messages sent to Discord channels:
 * - Loads enabled auto-message configs from the database on startup
 * - Maintains per-config interval timers that fire message sends
 * - Supports sequential and random rotation modes across message sets
 * - Resolves template variables (e.g. `{memberCount}`) before sending
 * - Allows individual configs to be started, stopped, or restarted at runtime
 *
 * NOTE: Requires a DiscordMessageService instance for the actual send calls
 */
export class AutoMessageService {
  private timers: Map<number, NodeJS.Timeout> = new Map();

  constructor(private readonly messageService: DiscordMessageService) {}

  /** Initializes the service by loading and starting all enabled configs */
  async initialize(): Promise<void> {
    await this.loadAndStartAll();
    logger.info("AutoMessageService initialized");
  }

  /** Stops all active timers and clears internal state */
  async shutdown(): Promise<void> {
    for (const [configId, timer] of this.timers) {
      clearInterval(timer);
      logger.debug(`Stopped auto-message timer for config ${configId}`);
    }
    this.timers.clear();
    logger.info("AutoMessageService stopped");
  }

  /**
   * Loads all enabled auto-message configs and starts their timers
   *
   * @returns Promise resolving when all timers are started
   */
  async loadAndStartAll(): Promise<void> {
    const configs = await Q.discord.auto.message.config
      .where({ enabled: true })
      .all();

    for (const config of configs) {
      this.startTimer(config);
    }

    logger.info(`Started ${configs.length} auto-message timer(s)`);
  }

  /**
   * Starts the timer for a single config by ID
   *
   * Does nothing if the config does not exist or is not enabled.
   *
   * @param configId - Database ID of the auto-message config to start
   */
  async startConfig(configId: number): Promise<void> {
    const config = await Q.discord.auto.message.config.get({ id: configId });
    if (!config || !config.enabled) return;
    this.startTimer(config);
  }

  /**
   * Stops the active timer for a single config
   *
   * Does nothing if no timer is currently running for the given config.
   *
   * @param configId - Database ID of the auto-message config to stop
   */
  stopConfig(configId: number): void {
    const timer = this.timers.get(configId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(configId);
      logger.debug(`Stopped auto-message timer for config ${configId}`);
    }
  }

  /**
   * Restarts the timer for a single config
   *
   * Stops any existing timer before re-fetching the config and starting fresh.
   * Useful when a config's interval or enabled state has changed.
   *
   * @param configId - Database ID of the auto-message config to restart
   */
  async restartConfig(configId: number): Promise<void> {
    this.stopConfig(configId);
    await this.startConfig(configId);
  }

  /**
   * Creates and registers the interval timer for a config
   *
   * Stops any previously running timer for the same config before starting a
   * new one. The interval fires `sendNextMessage` at the configured frequency.
   *
   * @param config - The auto-message config to schedule
   * @private
   */
  private startTimer(config: DiscordAutoMessageConfig): void {
    this.stopConfig(config.id);

    const intervalMs = config.intervalMinutes * 60 * 1000;

    const timer = setInterval(() => {
      this.sendNextMessage(config.id).catch((error) => {
        logger.error(
          `Error sending auto-message for config ${config.id}:`,
          error,
        );
      });
    }, intervalMs);

    this.timers.set(config.id, timer);
    logger.debug(
      `Started auto-message timer for config ${config.id} (every ${config.intervalMinutes}m)`,
    );
  }

  /**
   * Selects and sends the next message for a config
   *
   * Re-fetches the config on each call so that runtime changes (disable,
   * interval update) take effect immediately. Picks the next message using
   * the configured rotation mode (sequential or random), resolves any template
   * variables in the content, then delegates to DiscordMessageService.
   *
   * @param configId - Database ID of the auto-message config to process
   * @private
   */
  private async sendNextMessage(configId: number): Promise<void> {
    const config = await Q.discord.auto.message.config.get({ id: configId });
    if (!config || !config.enabled) {
      this.stopConfig(configId);
      return;
    }

    const messages = await Q.discord.auto.message
      .where({ configId, enabled: true })
      .orderBy("sortOrder", "asc")
      .all();

    if (messages.length === 0) {
      logger.debug(
        `No enabled messages for auto-message config ${configId}, skipping`,
      );
      return;
    }

    let message: (typeof messages)[0];

    if (config.rotationMode === "sequential") {
      const index = config.currentIndex % messages.length;
      message = messages[index];

      await Q.discord.auto.message.config.update(
        { id: configId },
        { currentIndex: (index + 1) % messages.length },
      );
    } else {
      message = messages[Math.floor(Math.random() * messages.length)];
    }

    const resolvedContent = await this.resolveTemplateVariables(
      message.content,
    );

    const result = await this.messageService.send({
      channelId: config.channelId,
      content: resolvedContent,
    });

    if (result.success) {
      logger.debug(
        `Sent auto-message to channel ${config.channelId} (config ${configId})`,
      );
    } else {
      logger.warn(
        `Failed to send auto-message to channel ${config.channelId}: ${result.error}`,
      );
    }
  }

  /**
   * Resolves template variables in message content.
   *
   * Supported variables:
   * - `{memberCount}` — total registered player count
   */
  private async resolveTemplateVariables(content: string): Promise<string> {
    if (!content.includes("{")) return content;

    let result = content;

    if (result.includes("{memberCount}")) {
      const count = await Q.player.count();
      result = result.replaceAll("{memberCount}", count.toString());
    }

    return result;
  }
}
