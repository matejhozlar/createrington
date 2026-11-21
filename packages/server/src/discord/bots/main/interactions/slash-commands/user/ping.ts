import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandCooldown,
  CommandModule,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

const cooldown: CommandCooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking ping again!",
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.reply({
    embeds: [EmbedPresets.loading("Calculating ping...").build()],
  });

  const message = await interaction.fetchReply();

  const latency = message.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;

  const embed = EmbedPresets.info("🏓 Pong!")
    .field("Bot Latency", `${latency}ms`, true)
    .field("WebSocket Latency", `${wsLatency}ms`, true)
    .timestamp()
    .build();

  await interaction.editReply({ embeds: [embed] });
}

export default {
  data,
  cooldown,
  execute,
} satisfies CommandModule;
