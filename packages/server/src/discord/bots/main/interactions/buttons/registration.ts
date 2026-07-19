import { EmbedPresets } from "@/discord/embeds";
import { Discord } from "@/discord/constants";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  type ButtonInteraction,
  type GuildChannel,
  MessageFlags,
} from "discord.js";

/**
 * Handles registration-related buttons
 * Pattern: registration:action
 */
export const pattern = "registration:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

/**
 * Parses the registration button customId (format: registration:action)
 *
 * @param customId - The button's customId string
 * @returns Parsed action, or null if invalid
 * @private
 */
function parseCustomId(customId: string): { action: string } | null {
  const [, action] = customId.split(":");
  if (!action) return null;
  return { action };
}

/**
 * Handles registration channel close button
 *
 * Deletes the verification channel after a 5-second delay
 * to allow the user to see the closing confirmation.
 *
 * @param interaction - The button interaction from Discord
 */
export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action } = parsed;

  if (action === "close") {
    try {
      const channel = interaction.channel;

      if (!channel || !isSendableChannel(channel) || channel.isDMBased()) {
        await interaction.reply({
          content: "❌ Channel not found or invalid",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const guildChannel = channel as GuildChannel & { name: string };
      const channelName = guildChannel.name;

      if (guildChannel.parentId !== Discord.Categories.VERIFICATION) {
        logger.warn(
          `User ${interaction.user.tag} clicked registration close outside the verification category (channel: ${channelName})`,
        );
        await interaction.reply({
          content: "❌ This button only works in a registration channel",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const deleteEmbed = EmbedPresets.channelDeletion();

      await interaction.update({
        embeds: [deleteEmbed.build()],
        components: [],
      });

      setTimeout(async () => {
        try {
          await channel.delete(
            `Registration completed - closed by ${interaction.user.tag}`,
          );
          logger.info(
            `Deleted registration channel ${channelName} - closed by ${interaction.user.tag}`,
          );
        } catch (error) {
          logger.error("Failed to delete registration channel:", error);
        }
      }, 5000);
    } catch (error) {
      logger.error("Failed to handle registration close button:", error);
    }
  }
}
