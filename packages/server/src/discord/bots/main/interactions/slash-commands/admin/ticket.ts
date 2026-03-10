import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { TicketType } from "@/services/discord/tickets";
import { Discord } from "@/discord/constants";
import { getService, Services } from "@/services";

/**
 * Slash command definition for the ticket command
 * Admin-only command to manually manage ticket operations
 */
export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Manage tickets")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket for a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Discord user").setRequired(true),
      ),
  );

/**
 * Cooldown configuration for the ticket command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before using the ticket command again!",
};

/**
 * Permission configuration for the ticket command
 * Requires administrator privileges to execute
 */
export const permissions = {
  requireAdmin: true,
};

/**
 * Executes the ticket command to manually manage tickets
 *
 * Process:
 * 1. Validates that the command is used in a valid channel
 * 2. Routes to the appropriate subcommand handler
 * 3. For "open" subcommand:
 *      - Retrieves the specified user
 *      - Creates a new generat ticket via ticketService
 *      - Sends ephemeral confirmation with ticket channel mention
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ticketService = await getService(
    Services.TICKET_SERVICE,
  );

  const subcommand = interaction.options.getSubcommand();
  try {
    if (!interaction.channel) {
      const embed = EmbedPresets.error(
        "Error",
        "This command can only be used in a channel.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "open") {
      const user = interaction.options.getUser("user", true);

      const result = await ticketService.createTicket({
        type: TicketType.GENERAL,
        creatorId: user.id,
      });

      const embed = EmbedPresets.success(
        "Ticket Created",
        `The ticket for user ${Discord.Users.mention(
          user.id,
        )} has been created: ${Discord.Channels.mention(
          result.ticket.channelId,
        )}`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const embed = EmbedPresets.error("Error", "Invalid subcommand.");

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (error) {
    logger.error("/ticket failed:", error);
    const embed = EmbedPresets.error(
      "Ticket Error",
      "Something went wrong while executing the command. Please try again.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
