import { player } from "@/db";
import type { PlayerPlaytimeBreakdown } from "@/db/queries/player/playtime/summary";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@/utils/format";
import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the playtime command
 * Displays the users playtime
 */
export const data = new SlashCommandBuilder()
  .setName("playtime")
  .setDescription("Check playtime of a user")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to check the playtime for")
      .setRequired(false),
  );

/**
 * Cooldown configuration for the playtime command
 *
 * - duration: 3 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking playtime again!",
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development environments
 */

/**
 * Executes the playtime command to display the users playtime
 *
 * Process:
 * 1. Get the target user (from option or command initiator)
 * 2. Fetch playtime data from the database
 * 3. Reply with the playtime information
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const userOption = interaction.options.getUser("user", false);
  const targetUser = userOption || interaction.user;

  try {
    const playerEntry = await player.get({ discordId: targetUser.id });
    const breakdown: PlayerPlaytimeBreakdown =
      await player.playtime.summary.getBreakdown(playerEntry.minecraftUuid);

    const topServers = breakdown.servers.slice(0, 5);
    const serverList = topServers
      .map(
        (server) =>
          `**${server.serverName}**: ${formatPlaytime(server.totalSeconds)}`,
      )
      .join("\n");

    const moreServers =
      breakdown.servers.length > 5
        ? `\n*+${breakdown.servers.length - 5} more server${breakdown.servers.length - 5 !== 1 ? "s" : ""}*`
        : "";

    const description = [
      `**Total Playtime**: ${formatPlaytime(breakdown.totals.totalSeconds)}`,
      `**Total Sessions**: ${breakdown.totals.totalSessions.toLocaleString()}`,
      `**Servers Played**: ${breakdown.totals.serverCount}`,
      "",
      "**Breakdown by Server:**",
      serverList + moreServers,
    ].join("\n");

    const embed = EmbedPresets.info(
      `${playerEntry.minecraftUsername}'s Playtime`,
      description,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    const embed = EmbedPresets.error(
      "Playtime Error",
      `Failed to fetch playtime for ${targetUser.displayName}. They may not have any recorded playtime yet.`,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
