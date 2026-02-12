import { EmbedPresets } from "@/discord/embeds";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the delete command
 * Admin utility command to bulk delete recent messages from a channel
 */
export const data = new SlashCommandBuilder()
  .setName("delete")
  .setDescription("Delete up to 100 recent messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName("count")
      .setDescription("Number of messages to delete (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  );

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development environments
 */

/**
 * Executes the delete command to bulk delete messages from a channel
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const count = interaction.options.getInteger("count", true);

  if (!interaction.channel || !("bulkDelete" in interaction.channel)) {
    const embed = EmbedPresets.error(
      "Invalid channel",
      "This command can only be used in text channels.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const deletedMessages = await interaction.channel.bulkDelete(count, true);

    const embed = EmbedPresets.success(
      "Message deleted",
      `Successfully deleted **${deletedMessages.size}** message${
        deletedMessages.size === 1 ? "" : "s"
      }.`,
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });

    logger.info(
      `${interaction.user.tag} deleted ${deletedMessages.size} messages in ${interaction.channel.name}`,
    );
  } catch (error) {
    logger.error("/delete failed:", error);

    const embed = EmbedPresets.error(
      "Deletion Failed",
      "Failed to delete messages. Make sure they are not older than 14 days.",
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });
  }
}
