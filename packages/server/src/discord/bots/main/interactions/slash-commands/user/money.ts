import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the money command
 * Displays the user's current balance from their linked Minecraft account
 */
export const data = new SlashCommandBuilder()
  .setName("money")
  .setDescription("Check your current balance");

/**
 * Cooldown configuration for the verify command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking your balance again!",
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development mode
 */

/**
 * Executes the money command to retrieve and display user's balance
 *
 * Process:
 * 1. Extract the Discord user ID from the interaction
 * 2. Query the database for the user's balance and Minecraft username
 * 3. Format the balance with proper number formatting
 * 4. Display the balance in an embed
 * 5. Handle and report any errors that occur during the process
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discordId = interaction.user.id;

  try {
    const player = await Q.player.get({ discordId });
    const balance = await Q.player.balance.get(player);

    const embed = EmbedPresets.plain({
      title: "💰 Your Balance",
      description: `$${BalanceUtils.formatWithCommas(balance.balance)}`,
    });

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/money failed:", error);

    const embed = EmbedPresets.error(
      "Balance Error",
      "Something went wrong while fetching your balance. Please try again.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
