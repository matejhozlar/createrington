import { Client, TextChannel } from "discord.js";
import {
  generateWelcomeCard,
  generateCustomWelcomeCard,
} from "@/discord/utils/welcome-card";
import { EmbedPresets } from "@/discord/embeds";
import config from "@/config";

const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;

/**
 * Registers the guildMemberAdd event handler
 *
 * This handler triggers when a new member joins the guild and:
 * 1. Generates a custom welcome card with the member's avatar
 * 2. Sends the image to the configured welcome channel
 * 3. Optionally sends a welcome embed message
 *
 * @param client - The Discord client instance
 */
export function registerWelcomeHandler(client: Client): void {
  if (!welcomeConfig.enabled) {
    logger.info("Welcome system is disabled");
    return;
  }

  if (!welcomeConfig.channelId) {
    logger.warn("Welcome system enabled but no channel ID configured");
    return;
  }

  client.on("guildMemberAdd", async (member) => {
    try {
      // Get the welcome channel
      const channel = await client.channels.fetch(welcomeConfig.channelId);

      if (!channel || !channel.isTextBased()) {
        logger.warn(
          `Welcome channel ${welcomeConfig.channelId} not found or is not a text channel`
        );
        return;
      }

      const textChannel = channel as TextChannel;

      // Get member count (their join position)
      const memberCount = member.guild.memberCount;

      // Generate the welcome card with custom configuration
      const welcomeCard = welcomeConfig.imageConfig.backgroundImageURL
        ? await generateCustomWelcomeCard(member, memberCount, {
            backgroundImageURL: welcomeConfig.imageConfig.backgroundImageURL,
            message: welcomeConfig.customMessage,
            config: welcomeConfig.imageConfig,
          })
        : await generateWelcomeCard(
            member,
            memberCount,
            welcomeConfig.imageConfig
          );

      logger.info(
        `Sending welcome message for ${member.user.tag} (Member #${memberCount})`
      );

      // Send the welcome image
      const welcomeMessage = await textChannel.send({
        content: welcomeConfig.customMessage || `Welcome ${member}! 🎉`,
        files: [welcomeCard],
      });

      // Optionally send an embed
      if (welcomeConfig.sendEmbed) {
        const embed = EmbedPresets.info(`Welcome to ${member.guild.name}!`)
          .description(
            `${member} just joined the server!\n\nYou are member **#${memberCount}**`
          )
          .thumbnail(member.user.displayAvatarURL())
          .field(
            "Account Created",
            `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            true
          )
          .field(
            "Joined Server",
            `<t:${Math.floor(Date.now() / 1000)}:R>`,
            true
          )
          .footer(`User ID: ${member.id}`)
          .build();

        await textChannel.send({ embeds: [embed] });
      }

      logger.debug(`Welcome message sent successfully for ${member.user.tag}`);
    } catch (error) {
      logger.error(
        `Failed to send welcome message for ${member.user.tag}:`,
        error
      );
    }
  });

  logger.info("Welcome handler registered");
}
