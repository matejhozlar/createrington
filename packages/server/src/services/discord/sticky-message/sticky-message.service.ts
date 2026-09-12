import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import type { DiscordEmbedBuilder } from "@/discord/embeds/embed-builder";
import { MessageFlags, type Client } from "discord.js";

export interface StickyMessageSpec {
  channelId: string;
  build: () => DiscordEmbedBuilder;
  repostDelayMs: number;
}

/**
 * Keeps bot-owned notice embeds at the bottom of Discord channels. A caller
 * describes its notice with a spec (channel, embed factory, repost delay):
 * `ensure` verifies on startup that the stored message still exists and
 * reposts it when it is gone, `touch` debounces a delete-and-repost after
 * channel activity so the notice stays the last message, and `repost` forces
 * one immediately. The current message id of each channel is stored in
 * discord_sticky_message. Discord failures are logged, never thrown.
 */
export class DiscordStickyMessageService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly bot: Client) {}

  /** Verifies the stored notice still exists in its channel and reposts it when it is missing. */
  async ensure(spec: StickyMessageSpec): Promise<void> {
    const existing = await Q.discord.sticky.message.find({
      channelId: spec.channelId,
    });

    if (
      existing &&
      (await this.messageExists(spec.channelId, existing.messageId))
    ) {
      logger.info(
        `Sticky message already present in ${spec.channelId}: ${existing.messageId}`,
      );
      return;
    }

    await this.repost(spec);
  }

  /** Debounces a repost after channel activity; calls within the delay collapse into one repost. */
  touch(spec: StickyMessageSpec): void {
    const pending = this.timers.get(spec.channelId);
    if (pending) {
      clearTimeout(pending);
    }

    this.timers.set(
      spec.channelId,
      setTimeout(async () => {
        this.timers.delete(spec.channelId);
        await this.repost(spec);
      }, spec.repostDelayMs),
    );
  }

  /** Deletes the current notice (if any) and posts a fresh one, storing the new message id. */
  async repost(spec: StickyMessageSpec): Promise<void> {
    try {
      const existing = await Q.discord.sticky.message.find({
        channelId: spec.channelId,
      });

      if (existing) {
        await Discord.Messages.delete({
          channelId: spec.channelId,
          messageId: existing.messageId,
        });
      }

      const result = await Discord.Messages.send({
        channelId: spec.channelId,
        embeds: spec.build().build(),
        flags: MessageFlags.SuppressNotifications,
      });

      if (!result.success || !result.messageId) {
        logger.error(`Failed to send sticky message to ${spec.channelId}`);
        return;
      }

      await Q.discord.sticky.message.upsert(
        {
          channelId: spec.channelId,
          messageId: result.messageId,
          updatedAt: new Date(),
        },
        "channelId",
        ["messageId", "updatedAt"],
      );

      logger.info(
        `Sticky message posted in ${spec.channelId}: ${result.messageId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to repost sticky message in ${spec.channelId}:`,
        error,
      );
    }
  }

  /** Cancels pending repost timers; in-flight Discord calls are not interrupted. */
  async shutdown(): Promise<void> {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private async messageExists(
    channelId: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (!channel || !channel.isTextBased() || !("messages" in channel)) {
        return false;
      }
      await channel.messages.fetch(messageId);
      return true;
    } catch {
      return false;
    }
  }
}
