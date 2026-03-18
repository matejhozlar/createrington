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
import { getEnabledServers } from "../../../config/server-selection";

/**
 * Slash command definition for the server-panel command
 * Admin-only command to create or update the server selection panel
 */
export const data = new SlashCommandBuilder()
  .setName("server-panel")
  .setDescription("Create or update the server selection panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("message_id")
      .setDescription("Message ID of an existing panel to update (sends new if omitted)")
      .setRequired(false),
  );

/**
 * Permission configuration for the server-panel command
 * Requires owner privileges to execute
 */
export const permissions = {
  requireOwner: true,
};

/**
 * Executes the server-panel command to create a server selection panel
 *
 * Process:
 * 1. Validates that command is used in a sendable text channel
 * 2. Gets all enabled servers from configuration
 * 3. Creates an embed with server information
 * 4. Generates buttons for each enabled server
 * 5. Sends the panel to the channel
 * 6. Sends ephemeral confirmation to the admin
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

    const enabledServers = getEnabledServers();

    if (enabledServers.length === 0) {
      const embed = EmbedPresets.error(
        "No Servers Available",
        "There are currently no enabled servers to display.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = createEmbed()
      .title("🎮 Server Selection")
      .description(
        "Welcome to Createrington! Click the buttons below to get access to server-specific channels.\n\n" +
          "**How it works:**\n" +
          "- Click a button to **join** a server (get access to its channels)\n" +
          "- Click again to **leave** a server (remove access)\n" +
          "- You can join multiple servers at once!\n\n" +
          "**Available Servers:**",
      )
      .color(EmbedColors.Info);

    enabledServers.forEach((server) => {
      embed.field(`${server.emoji} ${server.label}`, server.description, false);
    });

    const buttons = enabledServers.map((server) =>
      new ButtonBuilder()
        .setCustomId(`server-select:${server.id}`)
        .setLabel(server.label)
        .setEmoji(server.emoji)
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
        `Server selection panel has been updated with ${enabledServers.length} server(s)`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} updated server selection panel (${messageId}) with ${enabledServers.length} server(s)`,
      );
    } else {
      await interaction.channel.send(payload);

      const successEmbed = EmbedPresets.success(
        "Panel Created",
        `Server selection panel has been created with ${enabledServers.length} server(s)`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} created server selection panel with ${enabledServers.length} server(s)`,
      );
    }
  } catch (error) {
    logger.error("/server-panel failed:", error);

    const embed = EmbedPresets.error(
      "Panel Creation Failed",
      "Failed to create server selection. Please try again.",
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
