import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type GuildMember,
  MessageFlags,
} from "discord.js";
import {
  parseTicketButtonId,
  TicketStatus,
  type TicketType,
} from "@/services/discord/tickets";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import { Discord } from "@/discord/constants";
import { Q } from "@/db";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { isAdmin } from "@/discord/utils/admin-guard";
import { TicketSystemIds } from "@/services/discord/tickets";
import { getService, Services } from "@/services";

// A ticket button's customId carries the ticket ID, so it is attacker-spoofable — every mutation must re-check ownership.
async function authorizeTicketAction(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<{ creatorDiscordId: string } | null> {
  const ticket = await Q.ticket.find({ id: ticketId });
  if (!ticket) {
    await respondDenied(interaction, "Ticket not found");
    return null;
  }

  if (interaction.user.id === ticket.creatorDiscordId) {
    return ticket;
  }

  const member = interaction.member as GuildMember | null;
  if (
    member &&
    typeof member.roles !== "string" &&
    !Array.isArray(member.roles) &&
    (await isAdmin(member))
  ) {
    return ticket;
  }

  logger.warn(
    `User ${interaction.user.id} attempted ticket action on ticket ${ticketId} owned by ${ticket.creatorDiscordId}`,
  );
  await respondDenied(interaction, "You can't perform this action");
  return null;
}

async function respondDenied(
  interaction: ButtonInteraction,
  message: string,
): Promise<void> {
  const embed = EmbedPresets.error("Permission denied", message);
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Failed to send ticket permission-denied reply:", error);
  }
}

/**
 * Handles ticket-related buttons
 * Pattern: ticket:*
 */
export const pattern = "ticket:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

/**
 * Main button interaction handler for ticket system buttons
 *
 * Parses the button custom ID and routes to appropriate handler based on action type
 *
 * @param interaction - The button interaction from Discord
 * @returns Promise resolving when the interaction is handled
 * @throws Will catch and handle errors internally, sending error embeds to user
 */
export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseTicketButtonId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, ticketId, type } = parsed;

  try {
    if (action === "create" && type) {
      await handleCreate(interaction, type);
    } else if (action === "close" && ticketId) {
      await handleClose(interaction, ticketId);
    } else if (action === "confirm-close" && ticketId) {
      await handleConfirmClose(interaction, ticketId);
    } else if (action === "cancel-close" && ticketId) {
      await handleCancelClose(interaction, ticketId);
    } else if (action === "reopen" && ticketId) {
      await handleReopen(interaction, ticketId);
    } else if (action === "delete" && ticketId) {
      await handleDelete(interaction, ticketId);
    } else if (action === "transcript" && ticketId) {
      await handleTranscript(interaction, ticketId);
    } else {
      await interaction.reply({
        content: "Unknown action",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error(`Error handling ticket button (${action}):`, error);

    const errorEmbed = EmbedPresets.error(
      "Action Failed",
      error instanceof Error ? error.message : "An unknown error occurred",
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [errorEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.deferred) {
      try {
        await interaction.editReply({
          embeds: [errorEmbed.build()],
        });
      } catch (editError) {
        logger.error("Failed to edit reply:", editError);
      }
    }
  }
}

/**
 * Handles transcript generation and distribution for a ticket
 *
 * If a transcript already exists, sends it to the transcript channel
 * If not, generates a new transcript, saves the path to the ticket metadata
 * and then sends it to the transcript channel
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - Database ID of the ticket
 * @returns Promise resolving when the transcript is handled
 * @throws Will send error embed to user if transcript generation or sending fails
 */
async function handleTranscript(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferUpdate();

  try {
    const ticket = await Q.ticket.get({ id: ticketId });

    if (ticket.metadata?.transcriptPath) {
      await ticketService.sendTranscript(ticketId, interaction.user.id);

      const embed = EmbedPresets.success(
        "Transcript sent",
        `Transcript has been sent to ${Discord.Channels.mention(
          TicketSystemIds.TRANSCRIPT_CHANNEL,
        )}`,
      );

      await interaction.followUp({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const transcriptPath = await ticketService["generateTranscript"](ticket);

      await Q.ticket.updateAndReturn(
        { id: ticketId },
        {
          metadata: {
            ...ticket.metadata,
            transcriptPath,
          },
        },
      );

      await ticketService.sendTranscript(ticketId, interaction.user.id);

      const embed = EmbedPresets.success(
        "Transcript generated",
        `Transcript has been generated and sent to ${Discord.Channels.mention(
          TicketSystemIds.TRANSCRIPT_CHANNEL,
        )}`,
      );

      await interaction.followUp({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Failed to handle transcript:", error);

    const embed = EmbedPresets.error(
      "Transcript Failed",
      error instanceof Error
        ? error.message
        : "Failed to generate or send transcript",
    );

    await interaction.followUp({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles ticket creation button interaction
 *
 * Checks if the user already has an open ticket and prevents creation if so
 * Otherwise, creates a new ticket and channel through the ticket service
 *
 * @param interaction - The button interaction from Discord
 * @param type - The type of ticket to create
 * @returns Promise resolving when the ticket is created
 */
async function handleCreate(
  interaction: ButtonInteraction,
  type: TicketType,
): Promise<void> {
  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const hasOpen = await ticketService.hasOpenTicket(interaction.user.id);

  if (hasOpen) {
    const existingTicket = await Q.ticket.findAll(
      { creatorDiscordId: interaction.user.id, status: TicketStatus.OPEN },
      { limit: 1 },
    );
    const embed = EmbedPresets.error(
      "Ticket Already Open",
      `You already have an open ticket ${Discord.Channels.mention(
        existingTicket[0].channelId,
      )}. Please close it before creating a new one.`,
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });
    return;
  }

  const { channel } = await ticketService.createTicket({
    type,
    creatorId: interaction.user.id,
  });

  const embed = EmbedPresets.success(
    "Ticket Created",
    `Your ticket has been created: <#${channel.id}>`,
  );

  await interaction.editReply({
    embeds: [embed.build()],
  });
}

/**
 * Handles the initial close button interaction
 *
 * Sends a confirmation message via Confirm/Cancel buttons to prevent accidental closure
 * Does not actually close the ticket until confirmation is received
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - Dabase ID of the ticket to close
 * @returns Promise resolving when the confirmation is sent
 * @throws Error if the channel is not found or not sendable
 */
async function handleClose(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  await interaction.deferUpdate();

  if (!interaction.channel || !isSendableChannel(interaction.channel)) {
    throw new Error("Channel not found or is not a text channel");
  }

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:confirm-close:${ticketId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ticket:cancel-close:${ticketId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.channel.send({
    content: "⚠️ Are you sure you want to close this ticket?",
    components: [confirmRow],
  });
}

/**
 * Handles confirmed ticket closure
 *
 * Called when user clicks the "Confirm" button after initiating close
 * Closes the ticket through the ticket service and cleans up the confirmation message
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - The database ID of the ticket to close
 * @returns Promise resolving when the ticket is closed and message deleted
 */
async function handleConfirmClose(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferUpdate();

  await ticketService.closeTicket(ticketId, interaction.user.id, false);

  await interaction.message.delete().catch((error) => {
    logger.error("Failed to delete confirmation message:", error);
  });
}

/**
 * Handles cancelled ticket closure
 *
 * Called when user clicks the "Cancel" button after initiating close.
 * Simply removes the confirmation message without closing the ticket.
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - Database ID of the ticket (unused, but required for routing)
 * @returns Promise resolving when the confirmation message is deleted
 */
async function handleCancelClose(
  interaction: ButtonInteraction,
  _ticketId: number,
): Promise<void> {
  try {
    await interaction.message
      .delete()
      .catch((err) =>
        logger.error("Failed to delete cancel confirmation message:", err),
      );
  } catch (error) {
    logger.error("Failed to delete cancel confirmation message:", error);
  }
}

/**
 * Handles ticket reopening
 *
 * Reopens a closed ticket through the ticket service, restoring access to the ticket channel.
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - Database ID of the ticket to reopen
 * @returns Promise resolving when the ticket is reopened
 */
async function handleReopen(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await ticketService.reopenTicket(ticketId, interaction.user.id);
}

/**
 * Handles permanent ticket deletion
 *
 * Deletes the ticket from the database and schedules the Discord channel for deletion
 * after a 5-second delay to allow users to see the deletion notice.
 *
 * @param interaction - The button interaction from Discord
 * @param ticketId - The database ID of the ticket to delete
 * @returns Promise resolving when the deletion is initiated
 * @throws Error if the channel is not found or not sendable
 */
async function handleDelete(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  try {
    const ticketService = await getService(Services.TICKET_SERVICE);
    const channel = interaction.channel;

    if (!channel || !isSendableChannel(channel)) {
      throw new Error(`Channel not found or is not a text channel`);
    }

    await interaction.deferUpdate();

    const embed = EmbedPresets.plain({
      description: "Ticket will be deleted in a few seconds...",
      color: EmbedColors.Error,
    });

    await channel.send({ embeds: [embed.build()] });

    await ticketService.deleteTicket(ticketId, interaction.user.id);

    setTimeout(() => {
      channel.delete("Ticket deleted").catch((error) => {
        logger.error("Failed to delete ticket channel:", error);
      });
    }, 5000);
  } catch (error) {
    logger.error("Failed to handle ticket deletion:", error);

    if (interaction.channel && isSendableChannel(interaction.channel)) {
      try {
        const errorEmbed = EmbedPresets.error(
          "Deletion Failed",
          error instanceof Error ? error.message : "Failed to delete ticket",
        );

        await interaction.channel.send({
          embeds: [errorEmbed.build()],
        });
      } catch (sendError) {
        logger.error("Failed to send error message to channel:", sendError);
      }
    }
  }
}
