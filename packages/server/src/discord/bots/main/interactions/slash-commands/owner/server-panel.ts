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
import { getEnabledServers } from "../../../config/server-selection";

export const data = new SlashCommandBuilder()
  .setName("server-panel")
  .setDescription("Create or update the server selection panel")
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
  try {
    if (!isSendableChannel(interaction.channel)) {
      await replyError(
        interaction,
        "Invalid Channel",
        "This command can only be used in text channels.",
      );
      return;
    }

    const enabledServers = getEnabledServers();

    if (enabledServers.length === 0) {
      await replyError(
        interaction,
        "No Servers Available",
        "There are currently no enabled servers to display.",
      );
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

    await replyError(
      interaction,
      "Panel Creation Failed",
      "Failed to create server selection. Please try again.",
    );
  }
}
