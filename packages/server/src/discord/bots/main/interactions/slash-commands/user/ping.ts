import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the ping command
 * Simple utility command to check bot responsiveness and latency
 */
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

/**
 * Cooldown configuration for the ping command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking ping again!",
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development environments
 */

/**
 * Executes the ping command to measure bot latency
 *
 * Process:
 * 1. Sends an initial "loading" message
 * 2. Fetches the reply to calculate round-trip time
 * 3. Calculates bot latency (message creation time difference)
 * 4. Gets WebSocket latency (Discord gateway connection)
 * 5. Updates the message with both latency measurements
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 *
 * @example
 * // User runs: /ping
 * // Bot responds with:
 * // Pong!
 * // Bot Latency: 45ms
 * // WebSocket Latency: 32ms
 */
export async function execute(
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
