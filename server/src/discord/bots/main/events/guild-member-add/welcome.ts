import config from "@/config";
import { guildMemberJoins } from "@/db";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  generateCustomWelcomeCard,
  generateWelcomeCard,
} from "@/discord/utils/welcome-card";
import { Client, GuildMember, TextChannel } from "discord.js";
import { EventModule } from "../../loaders/event-loader";

const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;

/**
 * Welcome message event handler
 *
 * This handler:
 * 1. Records the member join in the database (gets persistent join number)
 * 2. Generates a welcome card image with their avatar and join number
 * 3. Sends the image to the welcome channel
 */
export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

/**
 * Whether this event should only be registered in production
 */
export const prodOnly = false;

/**
 * Executes a new member joins the guild
 *
 * @param client - The Discord client instance
 * @param member - THe guild member who joined
 */
export async function execute(
  client: Client,
  member: GuildMember
): Promise<void> {
  if (!welcomeConfig.enabled) {
    return;
  }

  if (!welcomeConfig.channelId) {
    logger.warn("Welcome system enabled but no channel ID configured");
    return;
  }

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

    const welcomeCard = welcomeConfig.imageConfig.backgroundImageURL
      ? await generateCustomWelcomeCard(member, joinNumber, {
          backgroundImageURL: welcomeConfig.imageConfig.backgroundImageURL,
          config: welcomeConfig.imageConfig,
        })
      : await generateWelcomeCard(
          member,
          joinNumber,
          welcomeConfig.imageConfig
        );

    logger.debug("Generated welcome card:", {
      hasBuffer: welcomeCard.attachment instanceof Buffer,
      bufferSize:
        welcomeCard.attachment instanceof Buffer
          ? welcomeCard.attachment.length
          : 0,
      name: welcomeCard.name,
    });

    const sentMessage = await textChannel.send({
      files: [welcomeCard],
    });

    logger.info(
      `Welcome image sent for ${member.user.tag} (#${joinNumber}) - Message ID: ${sentMessage.id}`
    );
  } catch (error) {
    logger.error(
      `Failed to send welcome message for ${member.user.tag}:`,
      error
    );
  }
}
