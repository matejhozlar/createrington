import { EmbedPresets } from "@/discord/embeds";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the purge command
 * Admin utility command to bulk purge recent messages from a channel
 */
export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Purge up to 100 recent messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName("count")
      .setDescription("Number of messages to purge (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Only purge messages from this user")
      .setRequired(false),
  );

/**
 * Executes the purge command to bulk delete messages from a channel
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const count = interaction.options.getInteger("count", true);
  const targetUser = interaction.options.getUser("user");

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

    let deletedMessages;

    if (targetUser) {
      const fetched = await interaction.channel.messages.fetch({
        limit: count,
      });
      const filtered = fetched.filter((m) => m.author.id === targetUser.id);
      deletedMessages = await interaction.channel.bulkDelete(filtered, true);
    } else {
      deletedMessages = await interaction.channel.bulkDelete(count, true);
    }

    const userSuffix = targetUser ? ` from ${targetUser.tag}` : "";

    const embed = EmbedPresets.success(
      "Messages purged",
      `Successfully purged **${deletedMessages.size}** message${
        deletedMessages.size === 1 ? "" : "s"
      }${userSuffix}.`,
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });

    logger.info(
      `${interaction.user.tag} purged ${deletedMessages.size} messages${userSuffix} in ${interaction.channel.name}`,
    );
  } catch (error) {
    logger.error("/purge failed:", error);

    const embed = EmbedPresets.error(
      "Purge Failed",
      "Failed to purge messages. Make sure they are not older than 14 days.",
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });
  }
}
