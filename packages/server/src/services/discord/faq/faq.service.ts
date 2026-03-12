import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type { Client, Message } from "discord.js";

interface CompiledPattern {
  id: number;
  regex: RegExp;
  title: string;
  response: string;
}

/** Delay before reposting the welcome message after channel activity */
const REPOST_DELAY_MS = 30_000;

/**
 * Discord FAQ Auto-Reply Service
 *
 * Monitors the questions channel and automatically replies to messages
 * matching configured FAQ patterns (keywords or regex):
 * - Loads enabled FAQ entries from the database on startup
 * - Matches incoming messages against compiled patterns (priority-ordered)
 * - Replies with a formatted embed when a match is found
 * - Manages a sticky welcome message that reposts after channel activity
 *
 * NOTE: Requires a Discord client (main bot) and is initialized
 * by the service container during startup
 */
export class FaqService {
  private patterns: CompiledPattern[] = [];
  private repostTimer?: ReturnType<typeof setTimeout>;
  private readonly channelId = Discord.Channels.general.QUESTIONS;

  constructor(private readonly bot: Client) {}

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initializes the service by loading FAQ patterns and ensuring
   * the welcome message exists in the questions channel
   *
   * @returns Promise resolving when the service is initialized
   */
  async initialize(): Promise<void> {
    logger.info("Initializing FaqService...");

    await this.refreshPatterns();
    await this.ensureWelcomeMessage();

    logger.info("FaqService initialized");
  }

  /**
   * Shuts down the service and clears the repost timer
   *
   * @returns Promise resolving when the service is stopped
   */
  async shutdown(): Promise<void> {
    if (this.repostTimer) {
      clearTimeout(this.repostTimer);
      this.repostTimer = undefined;
      logger.info("FaqService repost timer stopped");
    }
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Handles an incoming message in the questions channel
   *
   * Checks the message against all loaded FAQ patterns and replies
   * with the first match. Also schedules a welcome message repost
   * regardless of whether a match was found.
   *
   * @param message - Discord message to process
   * @returns Promise resolving when handling is complete
   */
  async handleMessage(message: Message): Promise<void> {
    const matched = this.matchPattern(message.content);

    if (matched) {
      const embed = EmbedPresets.faq.faqReply(matched.title, matched.response);

      await message.reply({ embeds: [embed.build()] });

      logger.info(
        `FAQ auto-replied to message ${message.id} with pattern #${matched.id} ("${matched.title}")`,
      );
    }

    this.scheduleWelcomeRepost();
  }

  /**
   * Reloads FAQ patterns from the database
   *
   * Fetches all enabled entries ordered by priority, compiles their
   * patterns (keywords or regex), and replaces the in-memory cache.
   * Invalid patterns are logged and skipped.
   *
   * @returns Promise resolving when patterns are refreshed
   */
  async refreshPatterns(): Promise<void> {
    const entries = await Q.faq.entry
      .where({ enabled: true })
      .orderBy("priority", "desc")
      .all();

    this.patterns = [];

    for (const entry of entries) {
      try {
        const regex =
          entry.matchMode === "keywords"
            ? keywordsToRegex(entry.pattern)
            : new RegExp(entry.pattern, "i");

        this.patterns.push({
          id: entry.id,
          regex,
          title: entry.title,
          response: entry.response,
        });
      } catch (error) {
        logger.warn(
          `FAQ entry #${entry.id} has invalid pattern "${entry.pattern}":`,
          error,
        );
      }
    }

    logger.info(`Loaded ${this.patterns.length} FAQ patterns`);
  }

  // ==========================================================================
  // WELCOME MESSAGE
  // ==========================================================================

  /**
   * Deletes the existing welcome message and posts a fresh one
   *
   * Ensures the welcome message is always at the bottom of the channel.
   * Updates the database record with the new message ID.
   *
   * @returns Promise resolving when the welcome message is reposted
   */
  async repostWelcomeMessage(): Promise<void> {
    try {
      const existing = await Q.faq.welcome.message.find({
        channelId: this.channelId,
      });

      if (existing) {
        await Discord.Messages.delete({
          channelId: this.channelId,
          messageId: existing.messageId,
        });
      }

      const embed = EmbedPresets.faq.welcomeMessage();
      const result = await Discord.Messages.send({
        channelId: this.channelId,
        embeds: embed.build(),
      });

      if (!result.success || !result.messageId) {
        logger.error("Failed to send FAQ welcome message");
        return;
      }

      if (existing) {
        await Q.faq.welcome.message.update(
          { id: existing.id },
          { messageId: result.messageId },
        );
      } else {
        await Q.faq.welcome.message.create({
          channelId: this.channelId,
          messageId: result.messageId,
        });
      }

      logger.info(`FAQ welcome message posted: ${result.messageId}`);
    } catch (error) {
      logger.error("Failed to repost FAQ welcome message:", error);
    }
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Finds the first FAQ pattern matching the message content
   *
   * @param content - Message content to match against
   * @returns The first matching pattern, or null if no match
   *
   * @private
   */
  private matchPattern(content: string): CompiledPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(content)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Schedules a debounced welcome message repost
   *
   * Resets the timer on each call so the repost only happens
   * after a period of inactivity (REPOST_DELAY_MS).
   *
   * @private
   */
  private scheduleWelcomeRepost(): void {
    if (this.repostTimer) {
      clearTimeout(this.repostTimer);
    }

    this.repostTimer = setTimeout(async () => {
      this.repostTimer = undefined;
      await this.repostWelcomeMessage();
    }, REPOST_DELAY_MS);
  }

  /** Converts a comma-separated keywords string to a regex pattern */
  static keywordsToRegex(keywords: string): RegExp {
    return keywordsToRegex(keywords);
  }

  /**
   * Ensures the welcome message exists in the channel
   *
   * Checks if the stored message ID still exists in the channel.
   * If not found (deleted or channel cleared), reposts it.
   *
   * @private
   */
  private async ensureWelcomeMessage(): Promise<void> {
    const existing = await Q.faq.welcome.message.find({
      channelId: this.channelId,
    });

    if (existing) {
      try {
        const channel = await this.bot.channels.fetch(this.channelId);
        if (channel && channel.isTextBased() && "messages" in channel) {
          await channel.messages.fetch(existing.messageId);
          logger.info(
            `FAQ welcome message already exists: ${existing.messageId}`,
          );
          return;
        }
      } catch {
        logger.info("FAQ welcome message not found in channel, reposting...");
      }
    }

    await this.repostWelcomeMessage();
  }
}

/** Escapes special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Converts comma-separated keywords into a case-insensitive alternation regex */
function keywordsToRegex(keywords: string): RegExp {
  const words = keywords
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map(escapeRegex);

  if (words.length === 0) {
    throw new Error("Keywords pattern must contain at least one keyword");
  }

  return new RegExp(`(?:${words.join("|")})`, "i");
}
