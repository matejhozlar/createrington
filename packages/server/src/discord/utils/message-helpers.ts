import type {
  ActionRowBuilder,
  EmbedBuilder,
  Message,
  MessageActionRowComponentBuilder,
  TextChannel,
} from "discord.js";
import { EmbedPresets } from "../embeds";

/**
 * Sends an embed message to a Discord text channel
 *
 * @param channel - The text channel to send the embed to
 * @param embed - The embed builder containing embed content
 * @returns Promise resolving to the sent message, or null if failed
 */
export async function sendEmbed(
  channel: TextChannel,
  embed: EmbedBuilder,
): Promise<Message | null> {
  try {
    return await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error("Failed to send embed:", error);
    return null;
  }
}

/**
 * Replies to a message with an embed
 *
 * @param message - Text message to reply to
 * @param embed - The embed builder containing the embed content
 * @returns Promise resolving to the replied message, or null if failed
 */
export async function replyWithEmbed(
  message: Message,
  embed: EmbedBuilder,
): Promise<Message | null> {
  try {
    return await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Failed to reply with embed:", error);
    return null;
  }
}

/**
 * Edits an existing embed message to display a new embed
 *
 * @param message - The message to edit
 * @param embed - The embed builder containing the new embed content
 * @returns Promise resolving to the edited message, or null if failed
 */
export async function editEmbed(
  message: Message,
  embed: EmbedBuilder,
): Promise<Message | null> {
  try {
    return await message.edit({ embeds: [embed] });
  } catch (error) {
    logger.error("Failed to edit embed:", error);
    return null;
  }
}

/**
 * Executes an async operation with a loading embed that updates based on the result
 * Displays a loading message, executes the operation, then updates the embed on success or error
 *
 * @template T - The return type of the operation
 * @param channel - The text channel to send the loading embed to
 * @param operation - The async operation to execute
 * @param options - Configuration options for the loading behaviour
 * @param options.loadingMessage - Optional custom loading message text
 * @param options.onSuccess - Optional callback to generate success embed from result
 * @param options.onError - Optional callback to generate error embed from error
 * @returns Promise resolving to the result of the operation
 * @throws Re-throws any error from the operation after updating the embed
 */
export async function withLoadingEmbed<T>(
  channel: TextChannel,
  operation: () => Promise<T>,
  options: {
    loadingMessage?: string;
    onSuccess?: (result: T) => EmbedBuilder;
    onError?: (error: Error) => EmbedBuilder;
  },
): Promise<T> {
  const loadingMsg = await sendEmbed(
    channel,
    EmbedPresets.loading(options.loadingMessage).build(),
  );

  try {
    const result = await operation();

    if (loadingMsg && options.onSuccess) {
      await editEmbed(loadingMsg, options.onSuccess(result));
    }

    return result;
  } catch (error) {
    if (loadingMsg && options.onError) {
      await editEmbed(loadingMsg, options.onError(error as Error));
    }
    throw error;
  }
}

/**
 * Sends an embed with action row components (buttons, select menus)
 *
 * @param channel - The text channel to send to
 * @param embed - The embed builder containing embed content
 * @param components - Action rows containing buttons or select menus
 * @returns Promise resolving to the sent message, or null if failed
 */
export async function sendEmbedWithComponents(
  channel: TextChannel,
  embed: EmbedBuilder,
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[],
): Promise<Message | null> {
  try {
    return await channel.send({
      embeds: [embed],
      components,
    });
  } catch (error) {
    logger.error("Failed to send embed with components:", error);
    return null;
  }
}

/**
 * Replaces a message's embed and action row components
 *
 * @param message - The message to edit
 * @param embed - The embed builder containing the new embed content
 * @param components - Action rows containing buttons or select menus
 * @returns Promise resolving to the edited message, or null if failed
 */
export async function editEmbedWithComponents(
  message: Message,
  embed: EmbedBuilder,
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[],
): Promise<Message | null> {
  try {
    return await message.edit({
      embeds: [embed],
      components,
    });
  } catch (error) {
    logger.error("Failed to edit embed with components:", error);
    return null;
  }
}
