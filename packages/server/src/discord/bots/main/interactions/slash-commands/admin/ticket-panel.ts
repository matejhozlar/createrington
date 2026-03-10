import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from "discord.js";
import { EmbedPresets } from "@/discord/embeds";
import { getAllTicketTypes } from "@/services/discord/tickets";
import { TicketButtonGenerator } from "@/services/discord/tickets";
import { isSendableChannel } from "@/discord/utils/channel-guard";

/**
 * Slash command definition for the ticket-panel command
 * Admin-only command to create or refresh the ticket support panel
 */
export const data = new SlashCommandBuilder()
  .setName("ticket-panel")
  .setDescription("Create or refresh the ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development environments
 */

/**
 * Executes the ticket-panel command to create a ticket support panel
 *
 * Process:
 * 1. Validates that the command is used in a sendable text channel
 * 2. Retrieves all configured ticket types from the system
 * 3. Creates an embed using the ticket panel preset
 * 4. Generates a button for each ticket type with label and emoji
 * 5. Sends the panel to the channel with all ticket buttons
 * 6. Sends ephemeral confirmation to the admin who ran the command
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    if (!isSendableChannel(interaction.channel)) {
      const embed = EmbedPresets.error(
        "Invalid Channel",
        "This command can only be used in text channels.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ticketTypes = getAllTicketTypes();

    const embed = EmbedPresets.ticket.panel();

    const buttons = ticketTypes.map((config) => {
      const button = new ButtonBuilder()
        .setCustomId(TicketButtonGenerator.create(config.type))
        .setLabel(config.label)
        .setStyle(ButtonStyle.Primary);

      try {
        button.setEmoji(config.emoji);
      } catch {
        logger.warn(
          `Invalid emoji for ticket type ${config.type}: ${config.emoji}`,
        );
      }

      return button;
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    await interaction.channel.send({
      embeds: [embed.build()],
      components: [row],
    });

    const successEmbed = EmbedPresets.success(
      "Panel Created",
      "Ticket panel has been created in this channel.",
    );

    await interaction.reply({
      embeds: [successEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/ticket-panel failed:", error);

    const embed = EmbedPresets.error(
      "Panel Creation Failed",
      "Failed to create ticket panel. Please try again.",
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        embeds: [embed.build()],
      });
    }
  }
}
