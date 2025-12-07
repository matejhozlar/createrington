import { Client, TextChannel } from "discord.js";
import { guildMemberJoins } from "@/db";
import config from "@/config";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { generateWelcomeCard } from "@/discord/utils/welcome-card";

const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;
/**
 * Registers the guildMemberAdd event handler
 *
 * This handler:
 * 1. Records the member join in the database (gets persistent join number)
 * 2. Generates a welcome card image with their avatar and join number
 * 3. Sends the image to the welcome channel (no text, no embed)
 *
 * @param client - The Discord client instance
 */
export function registerWelcomeHandler(client: Client): void {
  if (!welcomeConfig.enabled) {
    logger.info("Disabled");
    return;
  }

  if (!welcomeConfig.channelId) {
    logger.warn("Enabled, but no channel ID configured");
    return;
  }

  client.on("guildMemberAdd", async (member) => {
    try {
      const channel = await client.channels.fetch(welcomeConfig.channelId);

      if (!channel || !isSendableChannel(channel)) {
        logger.warn(
          `Welcome channel ${welcomeConfig.channelId} not found or is not a text channel`
        );
        return;
      }

      const textChannel = channel as TextChannel;

      const joinNumber = await guildMemberJoins.recordJoin(
        member.user.id,
        member.user.username
      );

      logger.info(`Member ${member.user.tag} joined - Join #${joinNumber}`);

      const welcomeCard = await generateWelcomeCard(
        member,
        joinNumber,
        welcomeConfig.imageConfig
      );

      await textChannel.send({
        files: [welcomeCard],
      });

      logger.debug(
        `Welcome image sent for ${member.user.tag} (#${joinNumber})`
      );
    } catch (error) {
      logger.error(
        `Failed to send welcome message for ${member.user.tag}:`,
        error
      );
    }
  });

  logger.info("Welcome handler registered");
}
