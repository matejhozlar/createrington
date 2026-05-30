import { player } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the username command
 * Checks and returns Minecraft username of the user
 */
export const data = new SlashCommandBuilder()
  .setName("username")
  .setDescription("Retrieve user's Minecraft username")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to retrieve username for")
      .setRequired(true),
  );

/**
 * Permission configuration for the username command
 * Requires admin privileges to execute
 */
export const permissions = {
  requireAdmin: true,
};

/**
 * Executes the username command to retrieve and display user's Minecraft username
 *
 * Process:
 * 1. Extract the user from the interaction options
 * 2. Retrieves username from the database
 * 3. Display the username in an embed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  try {
    const username = await player.select.minecraftUsername({
      discordId: user.id,
    });

    const embed = EmbedPresets.plain({
      description: `${username}`,
    });

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/username failed:", error);

    await replyError(
      interaction,
      "Username Error",
      "Something went wrong while fetching username. Please try again.",
    );
  }
}
