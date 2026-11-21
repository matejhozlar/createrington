import {
  type Channel,
  ChannelType,
  type DMChannel,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type TextChannel,
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

export type GuildTextChannel = TextChannel | NewsChannel;

export function isGuildTextChannel(
  channel: Channel | null,
): channel is GuildTextChannel {
  return (
    channel?.type === ChannelType.GuildText ||
    channel?.type === ChannelType.GuildAnnouncement
  );
}
