import config from "@/config";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import type {
  Client,
  Message,
  MessageCreateOptions,
  MessageEditOptions,
  TextChannel,
} from "discord.js";
import type {
  DeleteMessageOptions,
  EditMessageOptions,
  SendMessageOptions,
  SendMessageResult,
  FetchMessageOptions,
} from "./types";

/**
 * Unified Discord messaging surface for the bot client.
 *
 * Wraps send/edit/delete/fetch for messages in the configured guild. Created
 * once in bootstrap and reached through `Discord.Messages`. `allowedMentions`
 * defaults to `{ parse: [] }` so arbitrary content cannot ping @everyone,
 * roles, or users unless the caller opts in.
 */
export class DiscordMessageService {
  private readonly guildId: string;

  constructor(private client: Client) {
    this.guildId = config.discord.guild.id;
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
        flags: options.flags,
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
}
