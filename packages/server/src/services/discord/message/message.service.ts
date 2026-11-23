import config from "@/config";
import {
  isSendableChannel,
  type SendableChannel,
} from "@/discord/utils/channel-guard";
import {
  type Client,
  DiscordAPIError,
  type Message,
  type MessageCreateOptions,
  type MessageEditOptions,
  RESTJSONErrorCodes,
} from "discord.js";
import { ChannelUnavailableError, MessageGoneError } from "./errors";
import type {
  DeleteMessageOptions,
  EditMessageOptions,
  FetchMessageOptions,
  SendMessageOptions,
} from "./types";

function isDiscordError(error: unknown, code: RESTJSONErrorCodes): boolean {
  return error instanceof DiscordAPIError && error.code === code;
}

/**
 * Unified Discord messaging surface for the bot client.
 *
 * Wraps send/edit/delete/fetch for messages in the configured guild. Created
 * once in bootstrap and reached through `Discord.Messages`. Every method throws
 * on failure: `ChannelUnavailableError` when the channel is gone or not
 * sendable, `MessageGoneError` when the message was deleted, and Discord's own
 * error for anything else (missing permissions, 5xx). A caller that treats the
 * message as best effort says so with an explicit `.catch`. `allowedMentions`
 * defaults to `{ parse: [] }` so arbitrary content cannot ping @everyone,
 * roles, or users unless the caller opts in.
 */
export class DiscordMessageService {
  private readonly guildId: string;

  constructor(private client: Client) {
    this.guildId = config.discord.guild.id;
  }

  private async resolveChannel(channelId: string): Promise<SendableChannel> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = await guild.channels.fetch(channelId).catch((error) => {
      if (isDiscordError(error, RESTJSONErrorCodes.UnknownChannel)) {
        throw new ChannelUnavailableError(channelId, { cause: error });
      }
      throw error;
    });

    if (!channel || !isSendableChannel(channel)) {
      throw new ChannelUnavailableError(channelId);
    }
    return channel;
  }

  private async resolveMessage(
    channelId: string,
    messageId: string,
  ): Promise<Message> {
    const channel = await this.resolveChannel(channelId);
    return channel.messages.fetch(messageId).catch((error) => {
      if (isDiscordError(error, RESTJSONErrorCodes.UnknownMessage)) {
        throw new MessageGoneError(channelId, messageId, { cause: error });
      }
      throw error;
    });
  }

  /** Post a message to a channel. Suppresses all mentions unless `allowedMentions` is supplied. */
  async send(options: SendMessageOptions): Promise<Message> {
    const channel = await this.resolveChannel(options.channelId);

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
    return message;
  }

  /**
   * Edit an existing message. Pass `null` for `embeds` or `components` to
   * clear them, `undefined` (or omit) to leave them untouched.
   */
  async edit(options: EditMessageOptions): Promise<Message> {
    const message = await this.resolveMessage(
      options.channelId,
      options.messageId,
    );

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

    const edited = await message.edit(editOptions);
    logger.info(
      `Message ${options.messageId} edited in channel ${options.channelId}`,
    );
    return edited;
  }

  /** Delete a message. Throws `MessageGoneError` when it was already deleted. */
  async delete(options: DeleteMessageOptions): Promise<void> {
    const message = await this.resolveMessage(
      options.channelId,
      options.messageId,
    );
    await message.delete();
    logger.info(
      `Message ${options.messageId} deleted from channel ${options.channelId}`,
    );
  }

  /** Fetch a message by id. */
  async fetchMessage(options: FetchMessageOptions): Promise<Message> {
    return this.resolveMessage(options.channelId, options.messageId);
  }
}
