import { EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the message command
 * Sends the user input as a message through the bot
 */
export const data = new SlashCommandBuilder()
  .setName("message")
  .setDescription("Send a custom message to this channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("content")
      .setDescription("The message to send")
      .setRequired(true),
  );

/**
 * Permission configuration for the message command
 * Requires admin privileges to execute
 */
export const permissions = {
  requireAdmin: true,
};

/**
 * Executes the message command to send a bot message to the channel
 *
 * Process:
 * 1. Send the provided content as a bot message in the current channel
 * 2. Reply with an ephemeral confirmation
 *
 * @param interaction - The chat input command interaction
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const content = interaction.options.getString("content", true);

  try {
    if (isSendableChannel(interaction.channel)) {
      await interaction.channel.send(content);
    }
    const embed = EmbedPresets.success("Message Sent");
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/message failed:", error);

    await replyError(
      interaction,
      "Message Error",
      "Failed to send message to the channel. Please try again later.",
    );
  }
}
