import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { rewardService } from "@/services/reward";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the daily reward command
 * Allows users to claim their daily currency reward
 */
export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim your daily reward");

/**
 * Cooldown configuration for the daily command
 *
 * - duration: 10 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 10,
  type: CooldownType.USER,
  message: "Please wait before trying to claim your daily reward again!",
};

/**
 * Executes the daily reward command to claim daily currency
 *
 * Process:
 * 1. Extract Discord user ID from the interaction
 * 2. Check eligibility for daily reward via reward service
 * 3. If not eligible, display when they can claim next
 * 4. If eligible, attempt to claim the reward
 * 5. Display success message with amount claimed and new balance
 * 6. Handle and report any errors that occur during the process
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discordId = interaction.user.id;

  try {
    const eligibility = await rewardService.daily.checkEligibility({
      discordId,
    });

    if (!eligibility.eligible) {
      const embed = EmbedPresets.error(
        "Already Claimed",
        "You have already claimed your daily reward. Please try again later.",
      );

      if (eligibility.nextClaimTime) {
        const timestamp = Math.floor(
          eligibility.nextClaimTime.getTime() / 1000,
        );
        embed.field(
          "Next Claim",
          `<t:${timestamp}:F> (<t:${timestamp}:R>)`,
          false,
        );
      }

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await rewardService.daily.claim({ discordId });

    if (!result.success) {
      const embed = EmbedPresets.error(
        "Claim Failed",
        "Failed to claim your daily reward. Please try again.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = EmbedPresets.success(
      "💰 Daily Reward Claimed!",
      `You received **$${result.amount}**`,
    )
      .field("New Balance", `$${result.newBalance}`, true)
      .timestamp();

    if (result.nextClaimTime) {
      const timestamp = Math.floor(result.nextClaimTime.getTime() / 1000);
      embed.field("Next Claim", `<t:${timestamp}:R>`, true);
    }

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `User ${interaction.user.tag} (${discordId}) claimd daily reward: ${result.amount}`,
    );
  } catch (error) {
    logger.error("/daily failed:", error);

    const embed = EmbedPresets.error(
      "Daily Reward Error",
      "Something went wrong while claiming your reward. Please try again later.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
