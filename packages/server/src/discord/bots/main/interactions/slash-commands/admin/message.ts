import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import {
  type ChatInputCommandInteraction,
  GuildMember,
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
  .setDescription("Send a custom message to this channel (owner only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("content")
      .setDescription("The message to send")
      .setRequired(true),
  );

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development mode
 */

/**
 * Executes the message command to retrieve and display user's balance
 *
 * Process:
 * 1. Extract the Discord user ID from the interaction
 * 2. Checks if the interaction member has Owner role
 * 3. Sends the message to the channel
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const content = interaction.options.getString("content", true);

  if (RoleManager.has(member, Discord.Roles.OWNER)) {
    const embed = EmbedPresets.error("Interaction Failed");
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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

    const embed = EmbedPresets.error(
      "Message Error",
      "Failed to send message to the channel. Please try again later.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
