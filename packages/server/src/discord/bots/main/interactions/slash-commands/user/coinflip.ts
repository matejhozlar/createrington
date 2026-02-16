import { balanceRepo, player } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatBalance } from "@/utils/format";
import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

const MAX_BET = 50;

/**
 * Slash command definition for the coinflip command
 * Allows users to bet money on a 50/50 coin flip
 */
export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Flip a coin and bet money — double or nothing!")
  .addNumberOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Amount to bet (max $50)")
      .setRequired(true)
      .setMinValue(0.001)
      .setMaxValue(MAX_BET),
  );

/**
 * Cooldown configuration for the coinflip command
 *
 * - duration: 300 seconds (5 minutes)
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 300,
  type: CooldownType.USER,
  message: "Please wait before flipping again!",
};

/**
 * Executes the coinflip command to bet money on a coin flip
 *
 * Process:
 * 1. Validate the bet amount (max 3 decimals)
 * 2. Verify the player is registered and has sufficient balance
 * 3. Flip the coin (50/50 odds)
 * 4. Add winnings or deduct the bet from the player's balance
 * 5. Reply with the result and new balance
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const amount = interaction.options.getNumber("amount", true);

  try {
    BalanceUtils.validate(amount);
  } catch {
    const embed = EmbedPresets.error(
      "Invalid Amount",
      "Amount must have at most 3 decimal places.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const playerEntry = await player.find({ discordId: interaction.user.id });

    if (!playerEntry) {
      const embed = EmbedPresets.error(
        "Not Registered",
        "You must be registered to use coinflip. Use `/register` to get started.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasSufficient = await balanceRepo.hasSufficient(playerEntry, amount);

    if (!hasSufficient) {
      const currentBalance = await balanceRepo.getAmount(playerEntry);
      const embed = EmbedPresets.error(
        "Insufficient Balance",
        `You don't have enough money to bet.\n\n` +
          `**Your Balance:** ${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(currentBalance)))}\n` +
          `**Bet:** ${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(amount)))}`,
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const won = Math.random() < 0.5;
    const formattedBet = formatBalance(
      BalanceUtils.format(BalanceUtils.toStorage(amount)),
    );

    let newBalance: number;

    if (won) {
      newBalance = await balanceRepo.add(
        playerEntry,
        amount,
        "Coinflip win",
        BalanceTransactionType.REWARD,
        { game: "coinflip" },
      );
    } else {
      newBalance = await balanceRepo.deduct(
        playerEntry,
        amount,
        "Coinflip loss",
        BalanceTransactionType.PURCHASE,
        { game: "coinflip" },
      );
    }

    const formattedNewBalance = formatBalance(
      BalanceUtils.format(BalanceUtils.toStorage(newBalance)),
    );

    const embed = won
      ? EmbedPresets.success(
          "You won!",
          `The coin landed on **heads**! You won **${formattedBet}**.`,
        )
      : EmbedPresets.error(
          "You lost!",
          `The coin landed on **tails**. You lost **${formattedBet}**.`,
        );

    embed.field("New Balance", formattedNewBalance, true);

    await interaction.reply({ embeds: [embed.build()] });
  } catch (error) {
    logger.error("/coinflip failed:", error);

    const embed = EmbedPresets.error(
      "Coinflip Error",
      "Something went wrong. Please try again.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
