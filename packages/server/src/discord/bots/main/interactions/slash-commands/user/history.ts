import { balanceRepo, player } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

const TRANSACTION_LIMIT = 10;

const typeLabels: Record<string, string> = {
  transfer_send: "Transfer (sent)",
  transfer_receive: "Transfer (received)",
  deposit: "Deposit",
  withdraw: "Withdrawal",
  admin_grant: "Admin Grant",
  admin_deduct: "Admin Deduct",
  purchase: "Purchase",
  sale: "Sale",
  reward: "Reward",
  refund: "Refund",
  lottery_entry: "Lottery Entry",
  lottery_win: "Lottery Win",
  lottery_refund: "Lottery Refund",
  other: "Other",
};

export const data = new SlashCommandBuilder()
  .setName("history")
  .setDescription("View your recent balance transactions");

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking history again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const playerEntry = await player.find({ discordId: interaction.user.id });

    if (!playerEntry) {
      const embed = EmbedPresets.error(
        "Not Registered",
        "You must be registered to view history. Use `/register` to get started.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const transactions = await balanceRepo.getHistory(
      playerEntry,
      TRANSACTION_LIMIT,
    );

    if (transactions.length === 0) {
      const embed = EmbedPresets.info(
        "Transaction History",
        "You don't have any transactions yet.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = transactions.map((tx) => {
      const timestamp = Math.floor(tx.createdAt.getTime() / 1000);
      const isPositive = tx.amount >= 0n;
      const sign = isPositive ? "+" : "";
      const amount = BalanceUtils.formatTrimmed(tx.amount);
      const label = typeLabels[tx.transactionType] ?? tx.transactionType;
      const desc = tx.description ? ` — ${tx.description}` : "";

      return `<t:${timestamp}:R> **${sign}$${amount}** ${label}${desc}`;
    });

    const embed = EmbedPresets.info(
      "Transaction History",
      lines.join("\n"),
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/history failed:", error);

    const embed = EmbedPresets.error(
      "History Error",
      "Failed to fetch transaction history. Please try again.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
