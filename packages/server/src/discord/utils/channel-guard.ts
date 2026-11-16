import type {
  DMChannel,
  NewsChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  TextChannel,
  Channel,
} from "discord.js";

/**
 * Type for channels that support sending messages
 */
export type SendableChannel =
  | TextChannel
  | NewsChannel
  | PrivateThreadChannel
  | PublicThreadChannel
  | DMChannel;

/**
 * Type guard to check if a channel supports sending messages
 *
 * @param channel - The channel to check
 * @returns True if the channel has a send method
 */
export function isSendableChannel(
  channel: Channel | null,
): channel is SendableChannel {
  return (
    channel !== null && "send" in channel && typeof channel.send === "function"
  );
}
