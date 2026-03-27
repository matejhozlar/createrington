import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
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

/**
 * Slash command definition for the notification-panel command
 * Admin-only command to create or update the notification selection panel
 */
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

/**
 * Permission configuration for the notification-panel command
 * Requires owner privileges to execute
 */
export const permissions = {
  requireOwner: true,
};

/**
 * Executes the notification-panel command to create a notification selection panel
 *
 * Process:
 * 1. Validates that command is used in a sendable text channel
 * 2. Gets all enabled notifications from configuration
 * 3. Creates an embed with notification information
 * 4. Generates buttons for each enabled notification
 * 5. Sends the panel to the channel
 * 6. Sends ephemeral confirmation to the admin
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

    const enabledNotifications = getEnabledNotifications();

    if (enabledNotifications.length === 0) {
      const embed = EmbedPresets.error(
        "No Notifications Available",
        "There are currently no enabled notifications to display.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
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
        const errEmbed = EmbedPresets.error(
          "Message Not Found",
          `Could not find message with ID \`${messageId}\` in this channel.`,
        );
        await interaction.reply({
          embeds: [errEmbed.build()],
          flags: MessageFlags.Ephemeral,
        });
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
  } catch (error) {
    logger.error("/notification-panel failed:", error);

    const embed = EmbedPresets.error(
      "Panel Creation Failed",
      "Failed to create notification panel. Please try again.",
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
