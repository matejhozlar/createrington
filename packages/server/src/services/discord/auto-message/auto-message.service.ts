import { Q } from "@/db";
import type { DiscordMessageService } from "../message/message.service";
import type { DiscordAutoMessageConfig } from "@createrington/shared/db/discord_auto_message_config.types";

export class AutoMessageService {
  private timers: Map<number, NodeJS.Timeout> = new Map();

  constructor(private readonly messageService: DiscordMessageService) {}

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async initialize(): Promise<void> {
    await this.loadAndStartAll();
    logger.info("AutoMessageService initialized");
  }

  async shutdown(): Promise<void> {
    for (const [configId, timer] of this.timers) {
      clearInterval(timer);
      logger.debug(`Stopped auto-message timer for config ${configId}`);
    }
    this.timers.clear();
    logger.info("AutoMessageService stopped");
  }

  // ==========================================================================
  // CONFIG MANAGEMENT
  // ==========================================================================

  async loadAndStartAll(): Promise<void> {
    const configs = await Q.discord.auto.message.config
      .where({ enabled: true })
      .all();

    for (const config of configs) {
      this.startTimer(config);
    }

    logger.info(`Started ${configs.length} auto-message timer(s)`);
  }

  async startConfig(configId: number): Promise<void> {
    const config = await Q.discord.auto.message.config.get({ id: configId });
    if (!config || !config.enabled) return;
    this.startTimer(config);
  }

  stopConfig(configId: number): void {
    const timer = this.timers.get(configId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(configId);
      logger.debug(`Stopped auto-message timer for config ${configId}`);
    }
  }

  async restartConfig(configId: number): Promise<void> {
    this.stopConfig(configId);
    await this.startConfig(configId);
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

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
