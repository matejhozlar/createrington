import { Q } from "@/db";
import { discordTimestamp, pluralize } from "@/utils/format";
import { PlayerPromptComponentPresets } from "@/discord/components/presets/player-prompt";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";
import type { PlayerPromptEntryModeValue } from "@createrington/shared/player-prompt";

const MAX_MISSED_CLOSE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Outcome of the entry gate: either the responder may open the modal (with
 * the text to prefill and the entry slot they're filling), or they may not
 * and `message` explains why in Discord-ready copy.
 */
export type PlayerPromptEntryDecision =
  | { allowed: false; message: string }
  | {
      allowed: true;
      prompt: PlayerPrompt;
      prefill: string | null;
      entryNumber: number;
    };

/**
 * Node clamps setTimeout delays larger than the int32 ceiling
 * (~2^31 - 1 ms ≈ 24.86 days) to 1 ms and fires immediately. A prompt
 * scheduled further out than this needs to be woken up in chunks that
 * fit inside the ceiling.
 */
const MAX_TIMER_MS = 2_000_000_000;

/**
 * Player Prompt Service
 *
 * Owns the lifecycle of admin-authored prompts:
 * create → post to Discord with a Respond button → accept modal responses
 * → close at `ends_at` (or on demand) → edit the Discord message to show
 * a closed state with response count.
 *
 * Also the single source of truth for the entry rules. `single` prompts give
 * each player one editable answer; `multi` prompts let them stack entries up
 * to `maxEntries`, spaced by `cooldownSeconds`. Both the button (before the
 * modal opens) and the modal submit run the same gate, so a modal left open
 * past the limit still can't sneak an entry through.
 *
 * Uses setTimeout handles keyed by prompt id, mirroring MaintenanceScheduler.
 * On startup, `initialize()` reloads every active prompt and re-arms its
 * closure timer so a deploy doesn't lose pending closures.
 */
export class PlayerPromptService {
  private closureTimers = new Map<number, NodeJS.Timeout>();

  constructor(private messageService: DiscordMessageService) {}

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
            `Prompt #${prompt.id} missed close by ${Math.round(-msUntil / 1000)}s, closing now`,
          );
          await this.closePrompt(prompt.id).catch((err) =>
            logger.error(
              `Failed to close overdue prompt #${prompt.id} on boot:`,
              err,
            ),
          );
        } else {
          logger.warn(
            `Prompt #${prompt.id} missed close by more than ${MAX_MISSED_CLOSE_TOLERANCE_MS / 1000 / 60 / 60}h, force-closing without editing message`,
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

  /**
   * Creates a prompt row, posts the announcement to Discord, persists the
   * resulting message id, and arms its closure timer. Throws if the Discord
   * post fails (the DB row is rolled back in that case).
   */
  async createPrompt(opts: {
    question: string;
    description?: string | null;
    channelId: string;
    rolePingId?: string | null;
    durationMs: number;
    createdBy: string;
    entryMode?: PlayerPromptEntryModeValue;
    maxEntries?: number | null;
    cooldownSeconds?: number | null;
  }): Promise<PlayerPrompt> {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + opts.durationMs);
    const entryMode = opts.entryMode ?? "single";
    const isMulti = entryMode === "multi";

    const prompt = await Q.player.prompt.createAndReturn({
      question: opts.question,
      description: opts.description ?? null,
      channelId: opts.channelId,
      rolePingId: opts.rolePingId ?? null,
      startsAt,
      endsAt,
      status: "active",
      createdBy: opts.createdBy,
      entryMode,
      maxEntries: isMulti ? (opts.maxEntries ?? null) : null,
      cooldownSeconds: isMulti ? (opts.cooldownSeconds ?? null) : null,
    });

    const post = await this.postAnnouncement(prompt);
    if (!post.success || !post.messageId) {
      // Hard-fail: an active prompt without a Discord message is useless.
      await Q.player.prompt.delete({ id: prompt.id });
      throw new Error(
        `Failed to post prompt to Discord: ${post.error ?? "unknown"}`,
      );
    }

    // Persist the Discord message id. A transaction across the insert
    // and update wouldn't help here because the Discord post sits
    // between them, so we retry the update instead. Transient pool
    // exhaustion is the realistic failure mode, and losing the
    // messageId means closePrompt can't edit the announcement later.
    try {
      await this.persistMessageId(prompt.id, post.messageId);
    } catch (error) {
      logger.error(
        `Posted prompt #${prompt.id} to Discord (message ${post.messageId}) but failed to persist messageId. Close-time message edit will be skipped.`,
        error,
      );
    }

    this.armClosureTimer(prompt.id, opts.durationMs);
    return { ...prompt, messageId: post.messageId };
  }

  /**
   * Whether the responder may open the respond modal right now, plus the
   * text to prefill it with. Single-mode prompts prefill the existing answer
   * so a second click edits instead of retyping; multi-mode prompts always
   * open blank and are refused once the cap or cooldown bites.
   */
  async prepareEntry(
    promptId: number,
    discordId: string,
  ): Promise<PlayerPromptEntryDecision> {
    const prompt = await Q.player.prompt.find({ id: promptId });
    if (!prompt) {
      return { allowed: false, message: "That prompt no longer exists." };
    }

    const closed = this.closedMessage(prompt);
    if (closed) return { allowed: false, message: closed };

    if (prompt.entryMode === "single") {
      const existing = await Q.player.prompt.response.findLatestEntry(
        promptId,
        discordId,
      );
      return {
        allowed: true,
        prompt,
        prefill: existing?.responseText ?? null,
        entryNumber: 1,
      };
    }

    const stats = await Q.player.prompt.response.getEntryStats(
      promptId,
      discordId,
    );

    if (prompt.maxEntries !== null && stats.entryCount >= prompt.maxEntries) {
      return {
        allowed: false,
        message: this.capReachedMessage(prompt.maxEntries),
      };
    }

    const nextAllowedAt = this.nextEntryAt(prompt, stats.lastSubmittedAt);
    if (nextAllowedAt) {
      return { allowed: false, message: this.cooldownMessage(nextAllowedAt) };
    }

    return {
      allowed: true,
      prompt,
      prefill: null,
      entryNumber: stats.lastEntryNumber + 1,
    };
  }

  /**
   * Records a modal submission, re-running the entry gate first. Returns the
   * ephemeral copy to show the responder rather than throwing on a refusal:
   * only infrastructure failures escape as exceptions.
   */
  async submitResponse(opts: {
    promptId: number;
    discordId: string;
    responseText: string;
  }): Promise<string> {
    const decision = await this.prepareEntry(opts.promptId, opts.discordId);
    if (!decision.allowed) return decision.message;

    const { prompt } = decision;
    // Resolve the responder's Minecraft account if they've linked Discord.
    const player = await Q.player.find({ discordId: opts.discordId });
    const write = {
      promptId: opts.promptId,
      discordId: opts.discordId,
      minecraftUuid: player?.minecraftUuid ?? null,
      responseText: opts.responseText,
    };

    if (prompt.entryMode === "single") {
      await Q.player.prompt.response.upsertSingleEntry(write);
      return `Recorded. You can edit your response until ${discordTimestamp(prompt.endsAt)}.`;
    }

    const entry = await Q.player.prompt.response.appendEntry({
      ...write,
      maxEntries: prompt.maxEntries,
      cooldownSeconds: prompt.cooldownSeconds,
    });
    // Null means the cap or the cooldown bit between the gate read and the
    // insert, which enforces both itself. A concurrent submission loses here
    // rather than slipping past the snapshot the gate saw.
    if (!entry) return this.explainRefusedEntry(prompt, opts.discordId);

    const stats = await Q.player.prompt.response.getEntryStats(
      opts.promptId,
      opts.discordId,
    );
    return this.buildEntryConfirmation(prompt, entry.entryNumber, stats);
  }

  /**
   * Marks the prompt closed, cancels its timer, and edits the Discord
   * announcement to show a disabled button with the response count. Idempotent:
   * a no-op if the prompt is already closed or missing.
   */
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

    const totals = await Q.player.prompt.response.countByPrompt(promptId);

    if (prompt.messageId) {
      const closed = PlayerPromptComponentPresets.closed(prompt, totals);
      const result = await this.messageService.edit({
        channelId: prompt.channelId,
        messageId: prompt.messageId,
        // Prompts posted before the Components V2 switch still carry content
        // (the role mention) and an embed. Discord accepts the V2 flag on
        // edit only when both are empty, so clear them explicitly; the
        // mention comes back as a text display inside `closed.components`.
        content: null,
        embeds: null,
        components: closed.components,
        flags: closed.flags,
      });
      if (!result.success) {
        logger.warn(
          `Closed prompt #${promptId} in DB but failed to edit Discord message: ${result.error}`,
        );
      }
    }

    logger.info(
      `Closed prompt #${promptId} with ${totals.entryCount} entries from ${totals.responderCount} responders`,
    );
  }

  private async postAnnouncement(prompt: PlayerPrompt) {
    const active = PlayerPromptComponentPresets.active(prompt);

    return this.messageService.send({
      channelId: prompt.channelId,
      components: active.components,
      flags: active.flags,
      // Defense in depth: even though the Zod validator already
      // restricts rolePingId to digits, this ensures Discord will
      // refuse to ping anything else (especially @everyone/@here)
      // if a future code path bypasses the validator.
      allowedMentions: {
        roles: prompt.rolePingId ? [prompt.rolePingId] : [],
        parse: [],
      },
    });
  }

  /**
   * One retry on transient DB failure: if the post-Discord update
   * keeps failing past that, the caller logs and moves on with a
   * message-id-less row rather than losing the prompt entirely.
   */
  private async persistMessageId(
    promptId: number,
    messageId: string,
  ): Promise<void> {
    try {
      await Q.player.prompt.update({ id: promptId }, { messageId });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Q.player.prompt.update({ id: promptId }, { messageId });
    }
  }

  private closedMessage(prompt: PlayerPrompt): string | null {
    if (prompt.status !== "active" || prompt.endsAt.getTime() <= Date.now()) {
      return prompt.entryMode === "multi"
        ? "This prompt is closed. Entries are no longer accepted."
        : "This prompt is closed. Responses are no longer accepted.";
    }
    return null;
  }

  private nextEntryAt(
    prompt: PlayerPrompt,
    lastSubmittedAt: Date | null,
  ): Date | null {
    if (!prompt.cooldownSeconds || !lastSubmittedAt) return null;
    const readyAt = new Date(
      lastSubmittedAt.getTime() + prompt.cooldownSeconds * 1000,
    );
    return readyAt.getTime() > Date.now() ? readyAt : null;
  }

  private capReachedMessage(cap: number): string {
    return `You've used all ${cap} of your ${pluralize(cap, "entry", "entries")} on this prompt.`;
  }

  private cooldownMessage(readyAt: Date): string {
    return `You're on cooldown. You can add your next entry ${discordTimestamp(readyAt)}.`;
  }

  /**
   * Which rule refused an append. The insert enforces the cap and the
   * cooldown itself, so a null result means one of them bit after the gate
   * read; this re-reads to name the right one.
   */
  private async explainRefusedEntry(
    prompt: PlayerPrompt,
    discordId: string,
  ): Promise<string> {
    const stats = await Q.player.prompt.response.getEntryStats(
      prompt.id,
      discordId,
    );

    if (prompt.maxEntries !== null && stats.entryCount >= prompt.maxEntries) {
      return this.capReachedMessage(prompt.maxEntries);
    }

    const nextAllowedAt = this.nextEntryAt(prompt, stats.lastSubmittedAt);
    if (nextAllowedAt) return this.cooldownMessage(nextAllowedAt);

    return "Couldn't record that entry. Please try again.";
  }

  /**
   * Remaining entries come from the same row count the gate reads, not from
   * the entry number, so a gap in numbering can never inflate what the
   * responder is told is left.
   */
  private buildEntryConfirmation(
    prompt: PlayerPrompt,
    entryNumber: number,
    stats: { entryCount: number },
  ): string {
    const parts = [`Entry #${entryNumber} recorded.`];
    const remaining =
      prompt.maxEntries === null
        ? null
        : Math.max(0, prompt.maxEntries - stats.entryCount);

    if (remaining === 0) {
      parts.push("That was your last entry on this prompt.");
      return parts.join(" ");
    }
    if (remaining !== null) {
      parts.push(
        `You have ${remaining} ${pluralize(remaining, "entry", "entries")} left.`,
      );
    }
    if (prompt.cooldownSeconds) {
      const readyAt = new Date(Date.now() + prompt.cooldownSeconds * 1000);
      parts.push(`You can add another ${discordTimestamp(readyAt)}.`);
    } else {
      parts.push(
        `You can add another any time before ${discordTimestamp(prompt.endsAt)}.`,
      );
    }
    return parts.join(" ");
  }

  /**
   * Arms a closure timer for `msUntil` ms. If the duration exceeds
   * `MAX_TIMER_MS`, sets a shorter timer that re-arms itself with the
   * remainder: guarantees Node never sees an overflowing delay
   * regardless of prompt length.
   */
  private armClosureTimer(promptId: number, msUntil: number): void {
    const existing = this.closureTimers.get(promptId);
    if (existing) clearTimeout(existing);

    if (msUntil <= MAX_TIMER_MS) {
      const timer = setTimeout(() => {
        this.closePrompt(promptId).catch((err) =>
          logger.error(`Scheduled close failed for prompt #${promptId}:`, err),
        );
      }, msUntil);
      this.closureTimers.set(promptId, timer);
      return;
    }

    const timer = setTimeout(() => {
      this.closureTimers.delete(promptId);
      this.armClosureTimer(promptId, msUntil - MAX_TIMER_MS);
    }, MAX_TIMER_MS);
    this.closureTimers.set(promptId, timer);
  }
}
