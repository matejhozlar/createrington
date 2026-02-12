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

const REPOST_DELAY_MS = 30_000;

export class FaqService {
  private patterns: CompiledPattern[] = [];
  private repostTimer?: ReturnType<typeof setTimeout>;
  private readonly channelId = Discord.Channels.general.QUESTIONS;

  constructor(private readonly bot: Client) {}

  async initialize(): Promise<void> {
    logger.info("Initializing FaqService...");

    await this.refreshPatterns();
    await this.ensureWelcomeMessage();

    logger.info("FaqService initialized");
  }

  async shutdown(): Promise<void> {
    if (this.repostTimer) {
      clearTimeout(this.repostTimer);
      this.repostTimer = undefined;
      logger.info("FaqService repost timer stopped");
    }
  }

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

  async refreshPatterns(): Promise<void> {
    const entries = await Q.faq.entry
      .where({ enabled: true })
      .orderBy("priority", "desc")
      .all();

    this.patterns = [];

    for (const entry of entries) {
      try {
        this.patterns.push({
          id: entry.id,
          regex: new RegExp(entry.pattern, "i"),
          title: entry.title,
          response: entry.response,
        });
      } catch (error) {
        logger.warn(
          `FAQ entry #${entry.id} has invalid regex "${entry.pattern}":`,
          error,
        );
      }
    }

    logger.info(`Loaded ${this.patterns.length} FAQ patterns`);
  }

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

  private matchPattern(
    content: string,
  ): CompiledPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(content)) {
        return pattern;
      }
    }
    return null;
  }

  private scheduleWelcomeRepost(): void {
    if (this.repostTimer) {
      clearTimeout(this.repostTimer);
    }

    this.repostTimer = setTimeout(async () => {
      this.repostTimer = undefined;
      await this.repostWelcomeMessage();
    }, REPOST_DELAY_MS);
  }

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
        logger.info(
          "FAQ welcome message not found in channel, reposting...",
        );
      }
    }

    await this.repostWelcomeMessage();
  }
}
