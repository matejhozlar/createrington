import type {
  DMChannel,
  NewsChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  TextChannel,
  Channel,
} from "discord.js";

export type SendableChannel =
  | TextChannel
  | NewsChannel
  | PrivateThreadChannel
  | PublicThreadChannel
  | DMChannel;

export function isSendableChannel(
  channel: Channel | null,
): channel is SendableChannel {
  return (
    channel !== null && "send" in channel && typeof channel.send === "function"
  );
}
