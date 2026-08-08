import type { GuildMember } from "discord.js";
import config from "@/config";
import { Q } from "@/db";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { generateRegistrationWelcomeCard } from "@/discord/utils/welcome-card";

const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;

/** Posts the welcome card to the public welcome channel after a successful
 * registration. No-op in local dev (mirrors the prodOnly gate the card had as
 * a guildMemberAdd handler). Never throws: failures are logged so they cannot
 * affect the registration outcome. */
export async function postRegistrationWelcomeCard(params: {
  member: GuildMember;
  discordId: string;
  minecraftUuid: string;
  minecraftUsername: string;
}): Promise<void> {
  if (config.envMode.isDev) return;
  if (!welcomeConfig.enabled || !welcomeConfig.channelId) return;

  try {
    const memberNumber = await Q.discord.guild.member.join.recordJoin(
      params.discordId,
      params.member.user.username,
    );

    const channel = await params.member.client.channels.fetch(
      welcomeConfig.channelId,
    );
    if (!channel || !isSendableChannel(channel)) {
      logger.warn(
        `Welcome channel ${welcomeConfig.channelId} not found or is not a text channel`,
      );
      return;
    }

    const card = await generateRegistrationWelcomeCard({
      minecraftUuid: params.minecraftUuid,
      minecraftUsername: params.minecraftUsername,
      memberNumber,
    });

    await channel.send({
      content: `<@${params.discordId}>`,
      files: [card],
    });

    logger.info(
      `Welcome card sent for ${params.minecraftUsername} (member #${memberNumber})`,
    );
  } catch (error) {
    logger.error(
      `Failed to send welcome card for ${params.minecraftUsername}:`,
      error,
    );
  }
}
