import config from "@/config";
import { mainBot } from "@/discord/bots/main/client";
import {
  DiscordAPIError,
  RESTJSONErrorCodes,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

type MemberLookup =
  | { state: "found"; member: GuildMember }
  | { state: "gone" }
  | { state: "unavailable" };

type ChannelLookup =
  | { state: "found"; channel: GuildTextBasedChannel }
  | { state: "gone" }
  | { state: "unavailable" };

export function getGuild(): Guild | null {
  return mainBot.guilds.cache.get(config.discord.guild.id) ?? null;
}

export async function lookupMember(discordId: string): Promise<MemberLookup> {
  const guild = getGuild();
  if (!guild) return { state: "unavailable" };
  try {
    const member = await guild.members.fetch(discordId);
    return { state: "found", member };
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      (error.code === RESTJSONErrorCodes.UnknownMember ||
        error.code === RESTJSONErrorCodes.UnknownUser)
    ) {
      return { state: "gone" };
    }
    logger.warn(`Could not fetch guild member ${discordId}:`, error);
    return { state: "unavailable" };
  }
}

export async function lookupChannel(
  channelId: string | null,
): Promise<ChannelLookup> {
  if (!channelId) return { state: "gone" };
  try {
    const channel = await mainBot.channels.fetch(channelId);
    if (channel && channel.isTextBased() && !channel.isDMBased()) {
      return { state: "found", channel };
    }
    return { state: "gone" };
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      error.code === RESTJSONErrorCodes.UnknownChannel
    ) {
      return { state: "gone" };
    }
    logger.warn(`Could not fetch channel ${channelId}:`, error);
    return { state: "unavailable" };
  }
}
