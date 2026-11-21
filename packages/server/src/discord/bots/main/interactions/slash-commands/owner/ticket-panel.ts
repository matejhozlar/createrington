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
import { replyError } from "@/discord/utils/interaction-reply";
import { getAllTicketTypes } from "@/services/discord/tickets";
import { CustomIds } from "@/discord/custom-ids";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import type {
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("ticket-panel")
  .setDescription("Create or refresh the ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const permissions: CommandPermissions = {
  requireOwner: true,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isSendableChannel(interaction.channel)) {
    await replyError(
      interaction,
      "Invalid Channel",
      "This command can only be used in text channels.",
    );
    return;
  }

  const ticketTypes = getAllTicketTypes();

  const embed = EmbedPresets.ticket.panel();

  const buttons = ticketTypes.map((config) => {
    const button = new ButtonBuilder()
      .setCustomId(
        CustomIds.ticket.build({ action: "create", target: config.type }),
      )
      .setLabel(config.label)
      .setStyle(ButtonStyle.Primary);

    button.setEmoji(config.emoji);

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
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
