import config from "@/config";
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

export const data = new SlashCommandBuilder()
  .setName("donate-panel")
  .setDescription("Create or update the donation panel")
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

    const donateUrl = `${config.meta.links.website}/donate`;

    const embed = createEmbed()
      .title("❤️ Support Createrington")
      .description(
        "If you enjoy playing on Createrington, you can help keep the server running by donating.\n\n" +
          "**Donating is completely optional** and does not give you any advantages over other players. " +
          "All donations go directly towards server maintenance and upgrades.\n\n" +
          "Thank you for being part of the community!",
      )
      .color(EmbedColors.Info);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Donate")
        .setStyle(ButtonStyle.Link)
        .setURL(donateUrl)
        .setEmoji("❤️"),
    );

    const messageId = interaction.options.getString("message_id");
    const payload = { embeds: [embed.build()], components: [row] };

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
        "Donation panel has been updated.",
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} updated donation panel (${messageId})`,
      );
    } else {
      await interaction.channel.send(payload);

      const successEmbed = EmbedPresets.success(
        "Panel Created",
        "Donation panel has been created.",
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(`${interaction.user.tag} created donation panel`);
    }
  } catch (error) {
    logger.error("/donate-panel failed:", error);

    const embed = EmbedPresets.error(
      "Panel Creation Failed",
      "Failed to create donation panel. Please try again.",
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
