import { player } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { lotteryService, LotteryCooldownError } from "@/services/lottery";
import { discordTimestamp, formatBalance } from "@/utils/format";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import config from "@/config";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the lottery command
 * Allows users to start or join a lottery with a bet amount
 */
export const data = new SlashCommandBuilder()
  .setName("lottery")
  .setDescription("Start or join a lottery")
  .addNumberOption((option) =>
    option
      .setName("amount")
      .setDescription("Amount to enter with")
      .setRequired(true)
      .setMinValue(config.economy.lottery.minAmount),
  );

/**
 * Cooldown configuration for the lottery command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before using the lottery command again!",
};

/**
 * Executes the lottery command to start or join a lottery
 *
 * Process:
 * 1. Verify the player is registered
 * 2. If a lottery is active, join it with the specified amount
 * 3. If no lottery is active, start a new one
 * 4. Reply with the entry details, pot size, and participant count
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const amount = interaction.options.getNumber("amount", true);

  try {
    const foundPlayer = await player.find({ discordId: interaction.user.id });

    if (!foundPlayer) {
      await replyError(
        interaction,
        "Not Registered",
        "You must be registered to participate in the lottery. Use `/register` to get started.",
      );
      return;
    }

    if (lotteryService.isActive()) {
      const result = await lotteryService.join(
        foundPlayer.minecraftUuid,
        foundPlayer.minecraftUsername,
        amount,
      );

      const embed = EmbedPresets.success(
        "Lottery Joined",
        `You entered the lottery with **${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(result.entryAmount)))}**`,
      )
        .field(
          "Total Pot",
          formatBalance(
            BalanceUtils.format(BalanceUtils.toStorage(result.totalPot)),
          ),
          true,
        )
        .field("Players", `${result.participantCount}`, true);

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const result = await lotteryService.start(
        foundPlayer.minecraftUuid,
        foundPlayer.minecraftUsername,
        amount,
      );

      const embed = EmbedPresets.success(
        "Lottery Started",
        `You started a lottery with **${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(result.entryAmount)))}**`,
      ).field("Ends", discordTimestamp(result.endsAt, "R"), true);

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    }

    logger.info(
      `User ${interaction.user.tag} (${interaction.user.id}) used /lottery with $${amount}`,
    );
  } catch (error) {
    if (error instanceof LotteryCooldownError) {
      await replyError(
        interaction,
        "Lottery Cooldown",
        `The next lottery can start ${discordTimestamp(error.nextStartAt, "R")}.`,
      );
      return;
    }

    logger.error("/lottery failed:", error);

    await replyError(
      interaction,
      "Lottery Error",
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again later.",
    );
  }
}
