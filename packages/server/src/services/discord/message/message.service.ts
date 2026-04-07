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
 * General-purpose Discord messaging service
 *
 * Provides unified methods for all Discord message operations:
 * - send() - Handles text, embeds, components, and files
 * - edit() - Modifies existing messages
 * - delete() - Removes messages
 * - reply() - Creates replies to messages
 * - fetch() - Retrieves messages or channels
 * - withLoading() - Executes operations with loading state
 *
 * NOTE: Guild ID is automatically pulled from config
 * since this bot is exclusive to one Discord server
 */
export class DiscordMessageService {
  private static instance: DiscordMessageService;
  private readonly guildId: string;
  private static instances = new Map<Client, DiscordMessageService>();

  private constructor(private client: Client) {
    this.guildId = config.discord.guild.id;
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Gets the singleton instance of DiscordMessageService
   *
   * @param client - The Discord client instance to register on
   * @returns DiscordMessageService instance
   */
  public static getInstance(client: Client): DiscordMessageService {
    if (!DiscordMessageService.instances.has(client)) {
      DiscordMessageService.instances.set(
        client,
        new DiscordMessageService(client),
      );
    }
    return DiscordMessageService.instances.get(client)!;
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Fetches a channel and validates it's sendable
   *
   * @param channelId - The channel ID to fetch
   *
   * @private
   */
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

  // ==========================================================================
  // MESSAGE OPERATIONS
  // ==========================================================================

  /**
   * Send method - handles all message sending scenarios
   *
   * Automatically detects what needs to be sent based on options provided:
   * - Plain text
   * - Embed
   * - Buttons/Components
   * - Files
   * - Any combination of the above
   *
   * @param options - Message configuration
   * @returns Promise resolving to SendMessageResult
   *
   * @example
   * // Plain text
   * await messageService.send({
   *    channelId,
   *    content: "Hello World!"
   * });
   *
   * @example
   * // Embed only
   * await messageService.send({
   *    channelId,
   *    embeds: embed
   * });
   *
   * @example
   * // Everything combined
   * await messageService.send({
   *    channelId,
   *    embeds: embed,
   *    components: [components],
   *    files: [attachment],
   * });
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
   * Edit method - modifies existing messages
   *
   * Can update any combination of content, embeds, components, or files
   *
   * @param options - Edit configuration
   * @returns Promise resolving to SendMessageResult with edited message
   *
   * @example
   * // Edit just content
   * await messageService.edit({
   *    channelId,
   *    messageId,
   *    content: "Updated!"
   * });
   *
   * @example
   * // Edit embed and components
   * await messageService.edit({
   *    channelId,
   *    messageId,
   *    embeds: newEmbed
   *    components: [disabledButtons]
   * });
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
        embeds: options.embeds ? [options.embeds] : undefined,
        components: options.components,
        files: options.files,
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

  /**
   * Delete method - removes messages
   *
   * @param options - Delete configuration
   * @returns Promise resolving to success status
   *
   * @example
   * await messageService.delete({
   *    channelId,
   *    messageId,
   * });
   */
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
   * Reply method - creates replies to messages
   *
   * Supports all message types (text, embeds, components, files)
   *
   * @param options - Reply configuration
   * @returns Promise resolving to SendMessageResult with reply message
   *
   * @example
   * // Simple text reply
   * await messageService.reply({
   *    channelId,
   *    messageId,
   *    content: "Thanks!"
   * });
   *
   * @example
   * await messageService.reply({
   *    channelId,
   *    messageId,
   *    content: "Choose an option:",
   *    embeds: optionsEmbed,
   *    components: [buttonRow]
   * });
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

  // ==========================================================================
  // FETCH
  // ==========================================================================

  /**
   * Fetches a message from a channel
   *
   * @param options - Message fetch configuration
   * @returns Promise resolving to fetch result with message
   *
   * @example
   * const result = await messageService.fetchMessage({
   *    channelId,
   *    messageId
   * });
   * if (result.success) {
   *    await result.message.edit({ content: "Updated!" });
   * }
   */
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

  /**
   * Fetches a channel
   *
   * @param options - Channel fetch configuration
   * @returns Promise resolving to fetch result with channel
   *
   * @example
   * const result = await messageService.fetchChannel({
   *    channelId,
   * });
   * if (result.success) {
   *    await result.channel.send("Hello!");
   * }
   */
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

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Executes an operation with a loading message that updates on completion
   *
   * Useful for long-running operations where progress needs to be shown
   * The loading message will be automatically updated with success or error
   * state when operation completes
   *
   * @template T - The return type of the operation
   * @param channelId - Discord channel ID
   * @param operation - Async operation to execute
   * @param options - Configuration options for loading behavior
   * @returns Promise resolving to the operation result
   *
   * @example
   * const result = await messageService.withLoading(
   *    channelId,
   *    async () => {
   *        // Long-running operations
   *        await operation();
   *        return { processed: 100 };
   *    },
   *    {
   *        loadingMessage: "Processing data...",
   *        onSuccess: (result) => ({
   *            content: `Processed ${result.processed} items!`,
   *        })
   *        onError: (error) => ({
   *            content: `Failed: ${error.message}`,
   *        })
   *    }
   * )
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

/**
 * Factory function to create or get the DiscordMessageService instance
 *
 * @param client - Discord.js Client instance
 * @returns DiscordMessageService singleton instance
 */
export const createDiscordMessageService = (
  client: Client,
): DiscordMessageService => DiscordMessageService.getInstance(client);
