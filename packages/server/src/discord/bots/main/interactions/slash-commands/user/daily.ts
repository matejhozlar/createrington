import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { dailyRewardService } from "@/services/reward/daily-reward.service";
import { discordTimestamp } from "@/utils/format";
import { formatMoney } from "@createrington/shared/format";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandCooldown,
  CommandModule,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim your daily reward");

const cooldown: CommandCooldown = {
  duration: 10,
  type: CooldownType.USER,
  message: "Please wait before trying to claim your daily reward again!",
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discordId = interaction.user.id;

  const eligibility = await dailyRewardService.checkEligibility({
    discordId,
  });

  if (!eligibility.eligible) {
    const embed = EmbedPresets.error(
      "Already Claimed",
      "You have already claimed your daily reward. Please try again later.",
    );

    if (eligibility.nextClaimTime) {
      embed.field(
        "Next Claim",
        `${discordTimestamp(eligibility.nextClaimTime, "F")} (${discordTimestamp(eligibility.nextClaimTime, "R")})`,
        false,
      );
    }

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = await dailyRewardService.claim({ discordId });

  if (!result.success) {
    await replyError(
      interaction,
      "Claim Failed",
      "Failed to claim your daily reward. Please try again.",
    );
    return;
  }

  const embed = EmbedPresets.success(
    "💰 Daily Reward Claimed!",
    `You received **${formatMoney(result.amount ?? 0)}**`,
  )
    .field("New Balance", formatMoney(result.newBalance ?? 0), true)
    .timestamp();

  if (result.nextClaimTime) {
    embed.field(
      "Next Claim",
      discordTimestamp(result.nextClaimTime, "R"),
      true,
    );
  }

  await interaction.reply({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });

  logger.info(
    `User ${interaction.user.tag} (${discordId}) claimd daily reward: ${result.amount}`,
  );
}

export default {
  data,
  cooldown,
  execute,
} satisfies CommandModule;
