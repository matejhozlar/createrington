import { db, Q } from "@/db";
import { NotFoundError } from "@/errors";
import type { DatabaseQueries } from "@/generated/db";
import type { AdminActionType } from "@createrington/shared/admin-action";
import type { DiscordMessageService } from "../message/message.service";
import type { DiscordAutoMessageConfig } from "@createrington/shared/db/discord_auto_message_config.types";
import type { DiscordAutoMessage } from "@createrington/shared/db/discord_auto_message.types";

export interface AutoMessageActor {
  discordId: string;
  minecraftUsername: string;
}

export type AutoMessageConfigFields = Pick<
  DiscordAutoMessageConfig,
  "name" | "channelId" | "enabled" | "intervalMinutes" | "rotationMode"
>;

export interface AutoMessageFollowupInput {
  content: string;
  delaySeconds: number;
  enabled: boolean;
}

export interface AutoMessageFields {
  content: string;
  sortOrder: number;
  enabled: boolean;
}

/**
 * Drives scheduled, rotating Discord messages. On `initialize` it loads every
 * enabled `discord_auto_message_config` row and spins up one `setInterval`
 * per config. On each tick the config is re-fetched so runtime edits (disable,
 * interval change) take effect on the next fire; messages rotate sequentially
 * (with a persisted `currentIndex`) or randomly. Optional per-message
 * follow-ups are scheduled in-memory with additive delays and are dropped on
 * process restart. Template variables (e.g. `{memberCount}`) are resolved per
 * send. `shutdown` clears all timers; follow-up `setTimeout`s are not tracked
 * and may fire briefly during shutdown. Config and message edits go through
 * this service too, so the running timers follow every config change and
 * each config change is audited.
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
  shutdown(): void {
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
    const config = await Q.discord.auto.message.config.find({ id: configId });
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

  /** Creates a config, starts its timer when enabled, audits it. */
  async createConfig(
    fields: AutoMessageConfigFields,
    actor: AutoMessageActor,
  ): Promise<DiscordAutoMessageConfig> {
    const created = await Q.discord.auto.message.config.createAndReturn(fields);
    if (created.enabled) await this.startConfig(created.id);

    await this.audit(
      actor,
      "auto_message_config_create",
      `Created auto-message config "${created.name}"`,
    );
    return created;
  }

  /** Applies a patch to a config, restarts its timer to pick it up, audits it. */
  async updateConfig(
    configId: number,
    patch: Partial<AutoMessageConfigFields>,
    actor: AutoMessageActor,
  ): Promise<void> {
    const existing = await this.requireConfig(configId);

    await Q.discord.auto.message.config.update({ id: configId }, patch);
    await this.restartConfig(configId);

    await this.audit(
      actor,
      "auto_message_config_update",
      `Updated auto-message config "${existing.name}"`,
    );
  }

  /** Stops a config's timer, deletes it with its messages, audits it. */
  async deleteConfig(configId: number, actor: AutoMessageActor): Promise<void> {
    const existing = await this.requireConfig(configId);

    this.stopConfig(configId);
    await Q.discord.auto.message.config.delete({ id: configId });

    await this.audit(
      actor,
      "auto_message_config_delete",
      `Deleted auto-message config "${existing.name}"`,
    );
  }

  /** Adds a message with its follow-ups to a config in one transaction; without a sort order it goes last. */
  async createMessage(
    configId: number,
    {
      sortOrder,
      ...fields
    }: Omit<AutoMessageFields, "sortOrder"> & {
      sortOrder?: number;
    },
    followups: AutoMessageFollowupInput[],
  ): Promise<DiscordAutoMessage> {
    await this.requireConfig(configId);

    return db.inTransaction(async (tx) => {
      const created = await tx.discord.auto.message.createAndReturn({
        configId,
        ...fields,
        sortOrder:
          sortOrder ?? (await tx.discord.auto.message.nextSortOrder(configId)),
      });
      await this.insertFollowups(tx, created.id, followups);
      return created;
    });
  }

  /** Patches a message; when follow-ups are given they replace the existing ones. */
  async updateMessage(
    messageId: number,
    patch: Partial<AutoMessageFields>,
    followups?: AutoMessageFollowupInput[],
  ): Promise<void> {
    const existing = await Q.discord.auto.message.find({ id: messageId });
    if (!existing) throw new NotFoundError("Message not found");

    await db.inTransaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.discord.auto.message.update({ id: messageId }, patch);
      }
      if (followups !== undefined) {
        await tx.discord.auto.message.followup.deleteAll({ messageId });
        await this.insertFollowups(tx, messageId, followups);
      }
    });
  }

  private async requireConfig(
    configId: number,
  ): Promise<DiscordAutoMessageConfig> {
    const config = await Q.discord.auto.message.config.find({ id: configId });
    if (!config) throw new NotFoundError("Config not found");
    return config;
  }

  private async insertFollowups(
    tx: DatabaseQueries,
    messageId: number,
    followups: AutoMessageFollowupInput[],
  ): Promise<void> {
    await tx.discord.auto.message.followup.createMany(
      followups.map((followup, sortOrder) => ({
        messageId,
        ...followup,
        sortOrder,
      })),
    );
  }

  private async audit(
    actor: AutoMessageActor,
    actionType: AdminActionType,
    description: string,
  ): Promise<void> {
    await Q.admin.log.action.logAction({
      adminDiscordId: actor.discordId,
      adminUsername: actor.minecraftUsername,
      actionType,
      description,
    });
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
    const config = await Q.discord.auto.message.config.find({ id: configId });
    if (!config || !config.enabled) {
      this.stopConfig(configId);
      return;
    }

    const messages = await Q.discord.auto.message
      .where({ configId, enabled: true })
      .orderBy([{ field: "sortOrder" }, { field: "id" }])
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

    await this.messageService.send({
      channelId: config.channelId,
      content: resolvedContent,
    });
    logger.debug(
      `Sent auto-message to channel ${config.channelId} (config ${configId})`,
    );
    await this.scheduleFollowups(message.id, config.channelId);
  }

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

    await this.messageService.send({ channelId, content: resolvedContent });
    logger.debug(
      `Sent auto-message follow-up ${followupId} to channel ${channelId}`,
    );
  }

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
