import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Q } from "@/db";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";

const MAX_MISSED_CLOSE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Player Prompt Service
 *
 * Owns the lifecycle of admin-authored prompts:
 * create → post to Discord with a Respond button → accept modal responses
 * → close at `ends_at` (or on demand) → edit the Discord message to show
 * a closed state with response count.
 *
 * Uses setTimeout handles keyed by prompt id, mirroring MaintenanceScheduler.
 * On startup, `initialize()` reloads every active prompt and re-arms its
 * closure timer so a deploy doesn't lose pending closures.
 */
export class PlayerPromptService {
  private closureTimers = new Map<number, NodeJS.Timeout>();

  constructor(private messageService: DiscordMessageService) {}

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Reload every active prompt and either close it (if overdue) or re-arm
   * its closure timer. Called once on service bootstrap.
   */
  async initialize(): Promise<void> {
    const active = await Q.player.prompt.findAllActive();
    for (const prompt of active) {
      const msUntil = prompt.endsAt.getTime() - Date.now();

      if (msUntil <= 0) {
        if (msUntil >= -MAX_MISSED_CLOSE_TOLERANCE_MS) {
          logger.warn(
            `Prompt #${prompt.id} missed close by ${Math.round(-msUntil / 1000)}s — closing now`,
          );
          await this.closePrompt(prompt.id).catch((err) =>
            logger.error(
              `Failed to close overdue prompt #${prompt.id} on boot:`,
              err,
            ),
          );
        } else {
          logger.warn(
            `Prompt #${prompt.id} missed close by more than ${MAX_MISSED_CLOSE_TOLERANCE_MS / 1000 / 60 / 60}h — force-closing without editing message`,
          );
          await Q.player.prompt.update({ id: prompt.id }, { status: "closed" });
        }
      } else {
        this.armClosureTimer(prompt.id, msUntil);
        logger.info(
          `Restored closure timer for prompt #${prompt.id} (closes in ${Math.round(msUntil / 60000)} min)`,
        );
      }
    }
  }

  /** Clear every scheduled timer on shutdown. */
  shutdown(): void {
    for (const timer of this.closureTimers.values()) {
      clearTimeout(timer);
    }
    this.closureTimers.clear();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  async createPrompt(opts: {
    question: string;
    description?: string | null;
    channelId: string;
    rolePingId?: string | null;
    durationMs: number;
    createdBy: string;
  }): Promise<PlayerPrompt> {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + opts.durationMs);

    const prompt = await Q.player.prompt.createAndReturn({
      question: opts.question,
      description: opts.description ?? null,
      channelId: opts.channelId,
      rolePingId: opts.rolePingId ?? null,
      startsAt,
      endsAt,
      status: "active",
      createdBy: opts.createdBy,
    });

    const post = await this.postAnnouncement(prompt);
    if (!post.success || !post.messageId) {
      // Hard-fail — an active prompt without a Discord message is useless.
      await Q.player.prompt.delete({ id: prompt.id });
      throw new Error(
        `Failed to post prompt to Discord: ${post.error ?? "unknown"}`,
      );
    }

    await Q.player.prompt.update(
      { id: prompt.id },
      { messageId: post.messageId },
    );

    this.armClosureTimer(prompt.id, opts.durationMs);
    return { ...prompt, messageId: post.messageId };
  }

  async submitResponse(opts: {
    promptId: number;
    discordId: string;
    responseText: string;
  }): Promise<{ endsAt: Date }> {
    const prompt = await Q.player.prompt.find({ id: opts.promptId });
    if (!prompt) throw new Error("Prompt not found");
    if (prompt.status !== "active") {
      throw new Error("This prompt is closed");
    }
    if (prompt.endsAt.getTime() <= Date.now()) {
      throw new Error("This prompt has already ended");
    }

    // Resolve the responder's Minecraft account if they've linked Discord.
    const player = await Q.player.find({ discordId: opts.discordId });
    await Q.player.prompt.response.upsert({
      promptId: opts.promptId,
      discordId: opts.discordId,
      minecraftUuid: player?.minecraftUuid ?? null,
      responseText: opts.responseText,
    });

    return { endsAt: prompt.endsAt };
  }

  async closePrompt(promptId: number): Promise<void> {
    const timer = this.closureTimers.get(promptId);
    if (timer) {
      clearTimeout(timer);
      this.closureTimers.delete(promptId);
    }

    const prompt = await Q.player.prompt.find({ id: promptId });
    if (!prompt) return;
    if (prompt.status === "closed") return;

    await Q.player.prompt.update({ id: promptId }, { status: "closed" });

    const responseCount = await Q.player.prompt.response.count({
      promptId,
    });

    if (prompt.messageId) {
      const result = await this.messageService.edit({
        channelId: prompt.channelId,
        messageId: prompt.messageId,
        embeds: this.buildClosedEmbed(prompt, responseCount),
        components: [this.buildDisabledButtonRow(promptId)],
      });
      if (!result.success) {
        logger.warn(
          `Closed prompt #${promptId} in DB but failed to edit Discord message: ${result.error}`,
        );
      }
    }

    logger.info(`Closed prompt #${promptId} with ${responseCount} responses`);
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  private async postAnnouncement(prompt: PlayerPrompt) {
    const embed = this.buildActiveEmbed(prompt);
    const row = this.buildRespondButtonRow(prompt.id);
    const mention = prompt.rolePingId ? `<@&${prompt.rolePingId}>` : undefined;

    return this.messageService.send({
      channelId: prompt.channelId,
      content: mention,
      embeds: embed,
      components: [row],
    });
  }

  private buildActiveEmbed(prompt: PlayerPrompt): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(prompt.question)
      .setColor(0xe6b800)
      .setTimestamp(prompt.startsAt);

    if (prompt.description) {
      embed.setDescription(prompt.description);
    }

    const endsAtSeconds = Math.floor(prompt.endsAt.getTime() / 1000);
    embed.addFields({
      name: "Closes",
      value: `<t:${endsAtSeconds}:R>`,
    });

    embed.setFooter({
      text: "Click Respond to answer — you can edit your reply until it closes.",
    });

    return embed;
  }

  private buildClosedEmbed(
    prompt: PlayerPrompt,
    responseCount: number,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(prompt.question)
      .setColor(0x6b7280)
      .setTimestamp(prompt.startsAt);

    if (prompt.description) {
      embed.setDescription(prompt.description);
    }

    embed.addFields({
      name: "Status",
      value: `Closed — ${responseCount} response${responseCount === 1 ? "" : "s"} received.`,
    });

    return embed;
  }

  private buildRespondButtonRow(
    promptId: number,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prompt:respond:${promptId}`)
        .setLabel("Respond")
        .setStyle(ButtonStyle.Primary),
    );
  }

  private buildDisabledButtonRow(
    promptId: number,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prompt:respond:${promptId}`)
        .setLabel("Responses closed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  }

  private armClosureTimer(promptId: number, msUntil: number): void {
    const existing = this.closureTimers.get(promptId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.closurePromptFromTimer(promptId);
    }, msUntil);
    this.closureTimers.set(promptId, timer);
  }

  private closurePromptFromTimer(promptId: number): void {
    this.closePrompt(promptId).catch((err) =>
      logger.error(`Scheduled close failed for prompt #${promptId}:`, err),
    );
  }
}
