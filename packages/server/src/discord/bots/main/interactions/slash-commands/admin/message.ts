import { EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

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

export const permissions = {
  requireAdmin: true,
};

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
