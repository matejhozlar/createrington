import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { COMMAND_GROUPS, GROUP_ORDER } from "@/config/command-groups";
import config from "@/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "config",
  "discord-commands.json",
);

interface RawCommand {
  name: string;
  description: string;
  category: string;
  options: Array<{
    type: number;
    name: string;
    description?: string;
    options?: unknown[];
  }>;
}

interface CommandsFile {
  commands: RawCommand[];
}

function formatCommand(cmd: RawCommand): string {
  const subs = cmd.options.filter((o) => o.type === 1 || o.type === 2);

  if (subs.length > 0) {
    return subs
      .map((s) => `</${cmd.name} ${s.name}:0> — ${s.description ?? ""}`)
      .join("\n");
  }

  return `</${cmd.name}:0> — ${cmd.description}`;
}

export const data = new SlashCommandBuilder()
  .setName("command-docs-panel")
  .setDescription("Create or update the command docs panel")
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

    if (!fs.existsSync(JSON_PATH)) {
      const embed = EmbedPresets.error(
        "No Command Data",
        "discord-commands.json not found. Run `pnpm generate-command-docs:json` first.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const file = JSON.parse(
      fs.readFileSync(JSON_PATH, "utf-8"),
    ) as CommandsFile;

    const playerCommands = file.commands.filter(
      (cmd) => cmd.category === "user" || cmd.category === "public",
    );

    const grouped = new Map<string, RawCommand[]>();
    for (const cmd of playerCommands) {
      const group = COMMAND_GROUPS[cmd.name] ?? "Other";
      const list = grouped.get(group) ?? [];
      list.push(cmd);
      grouped.set(group, list);
    }

    const guideUrl = `${config.meta.links.website}/guides/discord-commands`;

    const embed = createEmbed()
      .title("Discord Commands")
      .description(
        `All available player commands. For full details, options, and usage examples visit the [command guide](${guideUrl}).`,
      )
      .color(EmbedColors.Info)
      .timestamp();

    for (const groupName of GROUP_ORDER) {
      const cmds = grouped.get(groupName);
      if (!cmds || cmds.length === 0) continue;

      const fieldValue = cmds.map((cmd) => formatCommand(cmd)).join("\n");
      embed.field(groupName, fieldValue, false);
    }

    const other = grouped.get("Other");
    if (other && other.length > 0) {
      const fieldValue = other.map((cmd) => formatCommand(cmd)).join("\n");
      embed.field("Other", fieldValue, false);
    }

    embed.footer(`${playerCommands.length} commands available`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Full Command Guide")
        .setStyle(ButtonStyle.Link)
        .setURL(guideUrl),
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
        `Command docs panel updated with ${playerCommands.length} commands.`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} updated command docs panel (${messageId})`,
      );
    } else {
      await interaction.channel.send(payload);

      const successEmbed = EmbedPresets.success(
        "Panel Created",
        `Command docs panel created with ${playerCommands.length} commands.`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(`${interaction.user.tag} created command docs panel`);
    }
  } catch (error) {
    logger.error("/command-docs-panel failed:", error);

    const errEmbed = EmbedPresets.error(
      "Panel Error",
      "Failed to create or update the command docs panel.",
    );

    const replyMethod =
      interaction.replied || interaction.deferred
        ? interaction.followUp
        : interaction.reply;

    await replyMethod.call(interaction, {
      embeds: [errEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
