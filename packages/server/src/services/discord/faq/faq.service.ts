import config from "@/config";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type {
  DiscordStickyMessageService,
  StickyMessageSpec,
} from "@/services/discord/sticky-message";
import { MessageFlags, type Message } from "discord.js";

interface CompiledPattern {
  id: number;
  regex: RegExp;
  title: string;
  response: string;
}

const REPOST_DELAY_MS = 5 * 60_000;

const FAQ_MAX_MATCH_LENGTH = 4000;

/**
 * Auto-replies in the questions channel using FAQ patterns loaded from the
 * database. Patterns are compiled once (keywords are escaped + alternated into
 * a case-insensitive regex; raw regex entries are validated and skipped on
 * parse failure) and matched priority-first against a length-capped slice of
 * the incoming message to bound regex cost. The channel's sticky welcome
 * embed is delegated to DiscordStickyMessageService: any activity debounces a
 * `REPOST_DELAY_MS` repost so it stays at the bottom. Disabled in dev:
 * `handleMessage` and `repostWelcomeMessage` early-return and the welcome
 * message is not verified on startup.
 */
export class FaqService {
  private patterns: CompiledPattern[] = [];
  private readonly welcome: StickyMessageSpec = {
    channelId: Discord.Channels.general.QUESTIONS,
    build: () => EmbedPresets.faq.welcomeMessage(),
    repostDelayMs: REPOST_DELAY_MS,
  };

  constructor(private readonly sticky: DiscordStickyMessageService) {}

  /** Compiles FAQ patterns from the DB and ensures the sticky welcome message exists in the channel (reposting it if the stored ID is missing). */
  async initialize(): Promise<void> {
    logger.info("Initializing FaqService...");

    await this.refreshPatterns();
    if (!config.envMode.isDev) {
      await this.sticky.ensure(this.welcome);
    }

    logger.info("FaqService initialized");
  }

  /** Replies with the first matching FAQ pattern (if any) and debounces a welcome-message repost regardless of match. No-op in dev. */
  async handleMessage(message: Message): Promise<void> {
    if (config.envMode.isDev) return;

    const matched = this.matchPattern(message.content);

    if (matched) {
      const embed = EmbedPresets.faq.faqReply(matched.title, matched.response);

      await message.reply({
        embeds: [embed.build()],
        flags: MessageFlags.SuppressNotifications,
      });

      logger.info(
        `FAQ auto-replied to message ${message.id} with pattern #${matched.id} ("${matched.title}")`,
      );
    }

    this.sticky.touch(this.welcome);
  }

  /** Recompiles the in-memory pattern cache from enabled DB entries (priority desc). Invalid regex entries are logged and skipped, not thrown. */
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

  /** Deletes the prior welcome message (if any) and sends a fresh one to keep it at the bottom of the channel. No-op in dev. */
  async repostWelcomeMessage(): Promise<void> {
    if (config.envMode.isDev) return;

    await this.sticky.repost(this.welcome);
  }

  private matchPattern(content: string): CompiledPattern | null {
    // Cap input so a pathological pattern can't burn unbounded CPU.
    const haystack =
      content.length > FAQ_MAX_MATCH_LENGTH
        ? content.slice(0, FAQ_MAX_MATCH_LENGTH)
        : content;
    for (const pattern of this.patterns) {
      if (pattern.regex.test(haystack)) {
        return pattern;
      }
    }
    return null;
  }

  /** Converts a comma-separated keywords string to a case-insensitive alternation regex; throws when the input contains no keywords. */
  static keywordsToRegex(keywords: string): RegExp {
    return keywordsToRegex(keywords);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
