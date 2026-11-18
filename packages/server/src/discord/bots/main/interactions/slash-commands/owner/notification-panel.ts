import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getEnabledNotifications } from "../../../config/notification-selection";

export const data = new SlashCommandBuilder()
  .setName("notification-panel")
  .setDescription("Create or update the notification selection panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("message_id")
      .setDescription(
        "Message ID of an existing panel to update (sends new if omitted)",
      )
      .setRequired(false),
  );

export const permissions = {
  requireOwner: true,
};

export async function execute(
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

  const enabledNotifications = getEnabledNotifications();

  if (enabledNotifications.length === 0) {
    await replyError(
      interaction,
      "No Notifications Available",
      "There are currently no enabled notifications to display.",
    );
    return;
  }

  const embed = createEmbed()
    .title("🔔 Notification Preferences")
    .description(
      "Choose which notifications you'd like to receive. Click the buttons below to toggle notifications on or off.\n\n" +
        "**How it works:**\n" +
        "- Click a button to **enable** notifications (get pinged)\n" +
        "- Click again to **disable** notifications (stop pings)\n\n" +
        "**Available Notifications:**",
    )
    .color(EmbedColors.Info);

  enabledNotifications.forEach((notification) => {
    embed.field(
      `${notification.emoji} ${notification.label}`,
      notification.description,
      false,
    );
  });

  const buttons = enabledNotifications.map((notification) =>
    new ButtonBuilder()
      .setCustomId(`notification-select:${notification.id}`)
      .setLabel(notification.label)
      .setEmoji(notification.emoji)
      .setStyle(ButtonStyle.Primary),
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      buttons.slice(i, i + 5),
    );
    rows.push(row);
  }

  const messageId = interaction.options.getString("message_id");
  const payload = { embeds: [embed.build()], components: rows };

  if (messageId) {
    const existing = await interaction.channel.messages
      .fetch(messageId)
      .catch(() => null);

    if (!existing) {
      await replyError(
        interaction,
        "Message Not Found",
        `Could not find message with ID \`${messageId}\` in this channel.`,
      );
      return;
    }

    await existing.edit(payload);

    const successEmbed = EmbedPresets.success(
      "Panel Updated",
      `Notification selection panel has been updated with ${enabledNotifications.length} notification(s)`,
    );
    await interaction.reply({
      embeds: [successEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `${interaction.user.tag} updated notification selection panel (${messageId}) with ${enabledNotifications.length} notification(s)`,
    );
  } else {
    await interaction.channel.send(payload);

    const successEmbed = EmbedPresets.success(
      "Panel Created",
      `Notification selection panel has been created with ${enabledNotifications.length} notification(s)`,
    );
    await interaction.reply({
      embeds: [successEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `${interaction.user.tag} created notification selection panel with ${enabledNotifications.length} notification(s)`,
    );
  }
}
