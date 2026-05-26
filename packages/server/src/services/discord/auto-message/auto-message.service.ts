import { Q } from "@/db";
import type { DiscordMessageService } from "../message/message.service";
import type { DiscordAutoMessageConfig } from "@createrington/shared/db/discord_auto_message_config.types";

/**
 * Drives scheduled, rotating Discord messages. On `initialize` it loads every
 * enabled `discord_auto_message_config` row and spins up one `setInterval`
 * per config. On each tick the config is re-fetched so runtime edits (disable,
 * interval change) take effect on the next fire; messages rotate sequentially
 * (with a persisted `currentIndex`) or randomly. Optional per-message
 * follow-ups are scheduled in-memory with additive delays and are dropped on
 * process restart. Template variables (e.g. `{memberCount}`) are resolved per
 * send. `shutdown` clears all timers; follow-up `setTimeout`s are not tracked
 * and may fire briefly during shutdown.
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

  /** Reloads every enabled config and (re)starts its timer; safe to call again at runtime to pick up newly enabled configs. */
  async loadAndStartAll(): Promise<void> {
    const configs = await Q.discord.auto.message.config
      .where({ enabled: true })
      .all();

    for (const config of configs) {
      this.startTimer(config);
    }

    logger.info(`Started ${configs.length} auto-message timer(s)`);
  }

  /** Starts the timer for one config by ID; no-op if the config is missing or disabled. */
  async startConfig(configId: number): Promise<void> {
    const config = await Q.discord.auto.message.config.get({ id: configId });
    if (!config || !config.enabled) return;
    this.startTimer(config);
  }

  /** Stops the active timer for a single config; no-op if none is running. */
  stopConfig(configId: number): void {
    const timer = this.timers.get(configId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(configId);
      logger.debug(`Stopped auto-message timer for config ${configId}`);
    }
  }

  /** Stops then re-fetches and restarts a single config; use after the config's interval or enabled flag changes. */
  async restartConfig(configId: number): Promise<void> {
    this.stopConfig(configId);
    await this.startConfig(configId);
  }

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
      await this.scheduleFollowups(message.id, config.channelId);
    } else {
      logger.warn(
        `Failed to send auto-message to channel ${config.channelId}: ${result.error}`,
      );
    }
  }

  // Each follow-up's delay is additive: follow-up #1 fires at t=delay1,
  // #2 at t=delay1+delay2, etc. Uses in-memory setTimeout, so a server
  // restart mid-chain drops pending follow-ups.
  private async scheduleFollowups(
    messageId: number,
    channelId: string,
  ): Promise<void> {
    const followups = await Q.discord.auto.message.followup
      .where({ messageId, enabled: true })
      .orderBy("sortOrder", "asc")
      .all();

    if (followups.length === 0) return;

    let accumulatedDelayMs = 0;
    for (const followup of followups) {
      accumulatedDelayMs += followup.delaySeconds * 1000;

      setTimeout(() => {
        this.sendFollowup(followup.id, channelId).catch((error) => {
          logger.error(
            `Error sending auto-message follow-up ${followup.id}:`,
            error,
          );
        });
      }, accumulatedDelayMs);
    }
  }

  private async sendFollowup(
    followupId: number,
    channelId: string,
  ): Promise<void> {
    const followup = await Q.discord.auto.message.followup.find({
      id: followupId,
    });
    if (!followup || !followup.enabled) return;

    const resolvedContent = await this.resolveTemplateVariables(
      followup.content,
    );

    const result = await this.messageService.send({
      channelId,
      content: resolvedContent,
    });

    if (result.success) {
      logger.debug(
        `Sent auto-message follow-up ${followupId} to channel ${channelId}`,
      );
    } else {
      logger.warn(
        `Failed to send auto-message follow-up ${followupId} to channel ${channelId}: ${result.error}`,
      );
    }
  }

  // Supported variables: {memberCount} (total registered player count).
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
