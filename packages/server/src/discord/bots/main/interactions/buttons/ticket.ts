import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  channelMention,
} from "discord.js";
import { isTicketType, type TicketType } from "@/services/discord/tickets";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import { Q } from "@/db";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { isAdmin } from "@/discord/utils/admin-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import { TicketSystemIds } from "@/services/discord/tickets";
import { getService, Services } from "@/services";

async function authorizeTicketAction(
  interaction: ButtonInteraction,
  ticketId: number,
  opts: { staffOnly?: boolean } = {},
): Promise<{ creatorDiscordId: string } | null> {
  const ticket = await Q.ticket.find({ id: ticketId });
  if (!ticket) {
    await respondDenied(interaction, "Ticket not found");
    return null;
  }

  if (!opts.staffOnly && interaction.user.id === ticket.creatorDiscordId) {
    return ticket;
  }

  if (interaction.inCachedGuild() && (await isAdmin(interaction.member))) {
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
  try {
    await replyError(interaction, "Permission denied", message);
  } catch (error) {
    logger.error("Failed to send ticket permission-denied reply:", error);
  }
}

const TICKET_ACTIONS = new Map<
  string,
  (interaction: ButtonInteraction, ticketId: number) => Promise<void>
>([
  ["close", handleClose],
  ["confirm-close", handleConfirmClose],
  ["cancel-close", handleCancelClose],
  ["reopen", handleReopen],
  ["delete", handleDelete],
  ["transcript", handleTranscript],
]);

async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = CustomIds.ticket.parse(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, target } = parsed;
  const ticketId = Number(target);
  const handler = TICKET_ACTIONS.get(action);

  if (action === "create" && isTicketType(target)) {
    await handleCreate(interaction, target);
  } else if (handler && Number.isInteger(ticketId) && ticketId > 0) {
    await handler(interaction, ticketId);
  } else {
    await interaction.reply({
      content: "Unknown action",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleTranscript(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferUpdate();

  const { generated } = await ticketService.ensureTranscript(ticketId);
  await ticketService.sendTranscript(ticketId, interaction.user.id);

  const channel = channelMention(TicketSystemIds.TRANSCRIPT_CHANNEL);
  const embed = generated
    ? EmbedPresets.success(
        "Transcript generated",
        `Transcript has been generated and sent to ${channel}`,
      )
    : EmbedPresets.success(
        "Transcript sent",
        `Transcript has been sent to ${channel}`,
      );

  await interaction.followUp({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleCreate(
  interaction: ButtonInteraction,
  type: TicketType,
): Promise<void> {
  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await ticketService.openTicket({
    type,
    creatorId: interaction.user.id,
  });

  if (!result.created) {
    await replyError(
      interaction,
      "Ticket Already Open",
      `You already have an open ticket ${channelMention(
        result.ticket.channelId,
      )}. Please close it before creating a new one.`,
    );
    return;
  }

  const embed = EmbedPresets.success(
    "Ticket Created",
    `Your ticket has been created: ${channelMention(result.channel.id)}`,
  );

  await interaction.editReply({
    embeds: [embed.build()],
  });
}

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
      .setCustomId(
        CustomIds.ticket.build({ action: "confirm-close", target: ticketId }),
      )
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(
        CustomIds.ticket.build({ action: "cancel-close", target: ticketId }),
      )
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.channel.send({
    content: "⚠️ Are you sure you want to close this ticket?",
    components: [confirmRow],
  });
}

async function handleConfirmClose(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferUpdate();

  await ticketService.closeTicket(ticketId, interaction.user.id);

  await interaction.message.delete().catch((error) => {
    logger.error("Failed to delete confirmation message:", error);
  });
}

async function handleCancelClose(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (!(await authorizeTicketAction(interaction, ticketId))) return;

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

async function handleReopen(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (
    !(await authorizeTicketAction(interaction, ticketId, { staffOnly: true }))
  )
    return;

  const ticketService = await getService(Services.TICKET_SERVICE);
  await interaction.deferUpdate();

  await ticketService.reopenTicket(ticketId, interaction.user.id);
}

async function handleDelete(
  interaction: ButtonInteraction,
  ticketId: number,
): Promise<void> {
  if (
    !(await authorizeTicketAction(interaction, ticketId, { staffOnly: true }))
  )
    return;

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
}

export default {
  customId: CustomIds.ticket,
  execute,
} satisfies ButtonModule;
