import { player } from "@/db";
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
export const prodOnly = false;

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
    const playtime = await player.playtime.summary.get({
      playerMinecraftUuid: playerEntry.minecraftUuid,
    });

    const embed = EmbedPresets.info(
      "Playtime",
      `${targetUser.displayName} (**${playerEntry.minecraftUsername}**) has played for **${formatPlaytime(Number(playtime.totalSeconds))}**`,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    const embed = EmbedPresets.error(
      "Playtime Error",
      `Failed to fetch playtime for ${targetUser.displayName}. Please try again.`,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
