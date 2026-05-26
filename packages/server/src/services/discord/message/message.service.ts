import config from "@/config";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  Client,
  EmbedBuilder,
  Message,
  type MessageCreateOptions,
  type MessageEditOptions,
  TextChannel,
} from "discord.js";
import type {
  DeleteMessageOptions,
  EditMessageOptions,
  ReplyMessageOptions,
  SendMessageOptions,
  SendMessageResult,
  FetchChannelOptions,
  FetchMessageOptions,
} from "./types";

/**
 * Unified Discord messaging surface for a single bot client.
 *
 * Wraps send/edit/delete/reply/fetch plus a `withLoading` helper that posts
 * a placeholder message and rewrites it once the wrapped operation resolves
 * or throws. Per-client singleton (keyed by Discord.js `Client` instance) so
 * the main bot and any auxiliary bots each get their own service. The guild
 * id is resolved once from config since the deployment targets one server,
 * and `allowedMentions` defaults to `{ parse: [] }` so arbitrary content
 * cannot ping @everyone, roles, or users unless the caller opts in.
 */
export class DiscordMessageService {
  private static instance: DiscordMessageService;
  private readonly guildId: string;
  private static instances = new Map<Client, DiscordMessageService>();

  private constructor(private client: Client) {
    this.guildId = config.discord.guild.id;
  }

  /** Per-client singleton accessor; creates the instance on first call. */
  public static getInstance(client: Client): DiscordMessageService {
    if (!DiscordMessageService.instances.has(client)) {
      DiscordMessageService.instances.set(
        client,
        new DiscordMessageService(client),
      );
    }
    return DiscordMessageService.instances.get(client)!;
  }

  private async fetchSendableChannel(
    channelId: string,
  ): Promise<TextChannel | null> {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !isSendableChannel(channel)) {
        logger.warn(
          `Channel ${channelId} not found or not sendable in guild ${this.guildId}`,
        );
        return null;
      }

      return channel as TextChannel;
    } catch (error) {
      logger.error(`Failed to fetch channel ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Post a message to a channel. Never throws: failures (unknown channel,
   * permission errors, Discord 5xx) are returned as `{ success: false, error }`.
   * Suppresses all mentions unless `allowedMentions` is supplied.
   */
  async send(options: SendMessageOptions): Promise<SendMessageResult> {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      // Default `{ parse: [] }`: arbitrary content cannot trigger @everyone / role / user pings unless the caller opts in.
      const messageOptions: MessageCreateOptions = {
        content: options.content,
        embeds: options.embeds ? [options.embeds] : undefined,
        components: options.components,
        files: options.files,
        flags: options.flags,
        allowedMentions: options.allowedMentions ?? { parse: [] },
      };

      const message = await channel.send(messageOptions);

      logger.info(
        `Message sent to ${options.channelId} - Message ID: ${message.id}`,
      );

      return {
        success: true,
        messageId: message.id,
        message,
      };
    } catch (error) {
      logger.error("Failed to send message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Edit an existing message. Pass `null` for `embeds` or `components` to
   * clear them, `undefined` (or omit) to leave them untouched. Returns
   * `{ success: false, error }` on failure rather than throwing.
   */
  async edit(options: EditMessageOptions): Promise<SendMessageResult> {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      const message = await channel.messages.fetch(options.messageId);

      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }

      // null → explicit clear ([] for arrays, null passes through for content);
      // undefined → omit from edit payload so Discord.js keeps existing value
      const editOptions: MessageEditOptions = {
        content: options.content,
        embeds:
          options.embeds === null
            ? []
            : options.embeds
              ? [options.embeds]
              : undefined,
        components:
          options.components === null ? [] : (options.components ?? undefined),
        files: options.files,
        allowedMentions: { parse: [] },
      };

      const editedMessage = await message.edit(editOptions);

      logger.info(
        `Message ${options.messageId} edited in channel ${options.channelId}`,
      );

      return {
        success: true,
        messageId: editedMessage.id,
        message: editedMessage,
      };
    } catch (error) {
      logger.error("Failed to edit message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /** Delete a message. Returns `{ success: false, error }` on failure rather than throwing. */
  async delete(
    options: DeleteMessageOptions,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      const message = await channel.messages.fetch(options.messageId);

      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }

      await message.delete();

      logger.info(
        `Message ${options.messageId} deleted from channel ${options.channelId}`,
      );

      return { success: true };
    } catch (error) {
      logger.error("Failed to delete message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post a reply to an existing message. Mentions are suppressed by default.
   * Returns `{ success: false, error }` on failure rather than throwing.
   */
  async reply(options: ReplyMessageOptions): Promise<SendMessageResult> {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      const message = await channel.messages.fetch(options.messageId);

      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }

      const replyMessage = await message.reply({
        content: options.content,
        embeds: options.embeds ? [options.embeds] : undefined,
        components: options.components,
        files: options.files,
        allowedMentions: { parse: [] },
      });

      logger.info(
        `Replied to message ${options.messageId} in channel ${options.channelId}`,
      );

      return {
        success: true,
        messageId: replyMessage.id,
        message: replyMessage,
      };
    } catch (error) {
      logger.error("Failed to reply to message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /** Fetch a message by id. Returns `{ success: false, error }` if the channel or message is gone. */
  async fetchMessage(
    options: FetchMessageOptions,
  ): Promise<
    { success: true; message: Message } | { success: false; error: string }
  > {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      const message = await channel.messages.fetch(options.messageId);

      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }

      return {
        success: true,
        message,
      };
    } catch (error) {
      logger.error("Failed to fetch message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /** Fetch a sendable text channel by id. Returns `{ success: false, error }` if unavailable. */
  async fetchChannel(
    options: FetchChannelOptions,
  ): Promise<
    { success: true; channel: TextChannel } | { success: false; error: string }
  > {
    try {
      const channel = await this.fetchSendableChannel(options.channelId);

      if (!channel) {
        return {
          success: false,
          error: "Channel not found or not sendable",
        };
      }

      return {
        success: true,
        channel,
      };
    } catch (error) {
      logger.error("Failed to fetch channel:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post a loading placeholder, run `operation`, then rewrite the placeholder
   * with the `onSuccess` / `onError` payload. The wrapped error is re-thrown
   * after the placeholder is updated, so callers can still try/catch.
   */
  async withLoading<T>(
    channelId: string,
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string;
      onSuccess?: (result: T) => {
        content?: string;
        embeds?: EmbedBuilder;
      };
      onError?: (error: Error) => {
        content?: string;
        embeds?: EmbedBuilder;
      };
    },
  ): Promise<T> {
    const loadingResult = await this.send({
      channelId,
      content: options.loadingMessage || "⏳ Processing...",
    });

    try {
      const result = await operation();

      if (
        loadingResult.success &&
        loadingResult.messageId &&
        options.onSuccess
      ) {
        const successOptions = options.onSuccess(result);
        await this.edit({
          channelId,
          messageId: loadingResult.messageId,
          content: successOptions.content,
          embeds: successOptions.embeds,
        });
      }

      return result;
    } catch (error) {
      if (loadingResult.success && loadingResult.messageId && options.onError) {
        const errorOptions = options.onError(error as Error);
        await this.edit({
          channelId,
          messageId: loadingResult.messageId,
          content: errorOptions.content,
          embeds: errorOptions.embeds,
        });
      }
      throw error;
    }
  }
}

export const createDiscordMessageService = (
  client: Client,
): DiscordMessageService => DiscordMessageService.getInstance(client);
