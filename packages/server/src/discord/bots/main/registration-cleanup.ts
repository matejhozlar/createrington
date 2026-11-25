import {
  ChannelType,
  type Client,
  DiscordAPIError,
  type Guild,
  type GuildTextBasedChannel,
  OverwriteType,
  RESTJSONErrorCodes,
  type TextChannel,
} from "discord.js";
import { Discord } from "@/discord/constants";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import config from "@/config";
import { lookupMember } from "@/services/waitlist/discord-lookup";

export const AUTO_CLOSE_MS = 24 * 60 * 60 * 1000;

export const CLOSE_GRACE_MS = 5000;

export function scheduleChannelClose(
  channel: GuildTextBasedChannel,
  delayMs: number,
  reason: string,
): void {
  const effectiveDelay = Math.max(delayMs, 0);

  setTimeout(() => void announceAndDelete(channel, reason), effectiveDelay);
}

async function announceAndDelete(
  channel: GuildTextBasedChannel,
  reason: string,
): Promise<void> {
  try {
    const closing = RegistrationComponentPresets.closing();
    await channel.send({
      components: closing.components,
      flags: closing.flags,
    });
  } catch {}

  setTimeout(
    () => void deleteRegistrationChannel(channel, reason),
    CLOSE_GRACE_MS,
  );
}

async function deleteRegistrationChannel(
  channel: GuildTextBasedChannel,
  reason: string,
): Promise<void> {
  try {
    await channel.delete(reason);
    logger.info(`Deleted registration channel ${channel.id}: ${reason}`);
  } catch (error) {
    logger.error(`Failed to delete registration channel ${channel.id}:`, error);
  }
}

export async function deleteVerificationChannelsOf(
  guild: Guild,
  discordId: string,
): Promise<void> {
  const channels = guild.channels.cache.filter(
    (channel): channel is TextChannel =>
      channel.parentId === Discord.Categories.VERIFICATION &&
      channel.type === ChannelType.GuildText &&
      channel.permissionOverwrites.cache.some(
        (overwrite) =>
          overwrite.type === OverwriteType.Member && overwrite.id === discordId,
      ),
  );

  for (const [, channel] of channels) {
    try {
      await channel.delete("Member left the server before registering");
      logger.info(
        `Deleted verification channel ${channel.id} of departed member ${discordId}`,
      );
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        error.code === RESTJSONErrorCodes.UnknownChannel
      ) {
        continue;
      }
      logger.warn(
        `Could not delete verification channel ${channel.id} of departed member ${discordId}:`,
        error,
      );
    }
  }
}

export async function sweepRegistrationChannels(bot: Client): Promise<void> {
  const guild = bot.guilds.cache.get(config.discord.guild.id);
  if (!guild) {
    logger.warn("Registration sweep: guild not found in cache");
    return;
  }

  const categoryId = Discord.Categories.VERIFICATION;
  const channels = guild.channels.cache.filter(
    (ch) => ch.parentId === categoryId && ch.type === ChannelType.GuildText,
  );

  if (channels.size === 0) return;

  let cleaned = 0;

  for (const [, channel] of channels) {
    if (channel.type !== ChannelType.GuildText) continue;

    const memberOverwrite = channel.permissionOverwrites.cache.find(
      (ow) => ow.type === OverwriteType.Member,
    );
    if (!memberOverwrite) continue;

    const lookup = await lookupMember(memberOverwrite.id);
    if (lookup.state === "unavailable") continue;

    if (lookup.state === "gone") {
      scheduleChannelClose(
        channel,
        0,
        "Registration channel cleanup - member no longer in server",
      );
      cleaned++;
      continue;
    }

    if (lookup.member.roles.cache.has(Discord.Roles.VERIFIED)) {
      scheduleChannelClose(
        channel,
        0,
        `Registration completed - auto-closed on startup (${lookup.member.user.tag})`,
      );
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(
      `Registration sweep: scheduled ${cleaned} channel(s) for deletion`,
    );
  }
}
