import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import { isValidLeaderboardType } from "@/services/discord/leaderboard/config";
import type { LeaderboardType } from "@/services/discord/leaderboard/types";
import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

async function execute(interaction: ButtonInteraction): Promise<void> {
  const type = CustomIds.leaderboardRefresh.parse(interaction.customId)?.type;

  if (!type || !isValidLeaderboardType(type)) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await handleRefresh(interaction, type);
}

async function handleRefresh(
  interaction: ButtonInteraction,
  type: LeaderboardType,
): Promise<void> {
  const leaderboardService = await getService(Services.LEADERBOARD_SERVICE);
  const cooldownCheck = await leaderboardService.canRefresh(type);

  if (!cooldownCheck.canRefresh) {
    const expiresAt = cooldownCheck.lastRefreshed!.getTime() + 60 * 60 * 1000;
    const unixTimestamp = Math.floor(expiresAt / 1000);

    await replyError(
      interaction,
      "Leaderboard on Cooldown",
      `This leaderboard can be refreshed <t:${unixTimestamp}:R>.`,
    );
    return;
  }

  await interaction.deferUpdate();

  const result = await leaderboardService.refresh(type, true);

  if (!result.success) {
    throw new Error(result.error || "Unknown error");
  }

  logger.info(`${interaction.user.tag} refreshed ${type} leaderboard`);
}

export default {
  customId: CustomIds.leaderboardRefresh,
  execute,
} satisfies ButtonModule;
