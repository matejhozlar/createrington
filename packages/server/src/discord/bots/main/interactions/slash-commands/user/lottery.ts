import { player } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { lotteryService } from "@/services/lottery";
import { formatBalance } from "@/utils/format";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import config from "@/config";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

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

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before using the lottery command again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const amount = interaction.options.getNumber("amount", true);

  try {
    const foundPlayer = await player.find({ discordId: interaction.user.id });

    if (!foundPlayer) {
      const embed = EmbedPresets.error(
        "Not Registered",
        "You must be registered to participate in the lottery. Use `/register` to get started.",
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
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
        .field("Total Pot", formatBalance(BalanceUtils.format(BalanceUtils.toStorage(result.totalPot))), true)
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

      const endsAtTimestamp = Math.floor(result.endsAt.getTime() / 1000);

      const embed = EmbedPresets.success(
        "Lottery Started",
        `You started a lottery with **${formatBalance(BalanceUtils.format(BalanceUtils.toStorage(result.entryAmount)))}**`,
      ).field("Ends", `<t:${endsAtTimestamp}:R>`, true);

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    }

    logger.info(
      `User ${interaction.user.tag} (${interaction.user.id}) used /lottery with $${amount}`,
    );
  } catch (error) {
    logger.error("/lottery failed:", error);

    const embed = EmbedPresets.error(
      "Lottery Error",
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again later.",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
