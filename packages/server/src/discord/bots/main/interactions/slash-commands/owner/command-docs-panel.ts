import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import config from "@/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
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
  "config",
  "discord-commands.json",
);

interface RawCommand {
  name: string;
  description: string;
  category: string;
  options: Array<{ type: number; name: string; options?: unknown[] }>;
}

interface CommandsFile {
  commands: RawCommand[];
}

const COMMAND_GROUPS: Record<string, string> = {
  verify: "Getting Started",
  register: "Getting Started",
  money: "Economy",
  daily: "Economy",
  pay: "Economy",
  lottery: "Economy",
  history: "Economy",
  playtime: "Player Info",
  compare: "Player Info",
  profile: "Player Info",
  activity: "Player Info",
  seen: "Player Info",
  skin: "Player Info",
  top: "Player Info",
  crypto: "Crypto",
  ping: "Server",
  status: "Server",
  list: "Server",
};

const GROUP_ORDER = [
  "Getting Started",
  "Economy",
  "Player Info",
  "Crypto",
  "Server",
];

function buildCommandLine(cmd: RawCommand): string {
  const subs = cmd.options.filter((o) => o.type === 1 || o.type === 2);
  if (subs.length > 0) {
    const subNames = subs.map((s) => `\`/${cmd.name} ${s.name}\``);
    return subNames.join("  ");
  }
  return `\`/${cmd.name}\``;
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

    // Group commands
    const grouped = new Map<string, RawCommand[]>();
    for (const cmd of playerCommands) {
      const group = COMMAND_GROUPS[cmd.name] ?? "Other";
      const list = grouped.get(group) ?? [];
      list.push(cmd);
      grouped.set(group, list);
    }

    // Build description
    const guideUrl = `${config.meta.links.website}/guides/discord-commands`;
    const sections: string[] = [];

    sections.push(`**[View the full interactive guide](${guideUrl})**\n`);

    for (const groupName of GROUP_ORDER) {
      const cmds = grouped.get(groupName);
      if (!cmds || cmds.length === 0) continue;

      const lines = cmds.map((cmd) => buildCommandLine(cmd)).join("  ");
      sections.push(`**${groupName}**\n${lines}`);
    }

    // Add ungrouped if any
    const other = grouped.get("Other");
    if (other && other.length > 0) {
      const lines = other.map((cmd) => buildCommandLine(cmd)).join("  ");
      sections.push(`**Other**\n${lines}`);
    }

    const embed = createEmbed()
      .title("Discord Commands")
      .description(sections.join("\n\n"))
      .color(EmbedColors.Info);

    const messageId = interaction.options.getString("message_id");
    const payload = { embeds: [embed.build()] };

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
