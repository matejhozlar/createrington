import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import { isValidLeaderboardType } from "@/services/discord/leaderboard/config";
import type { LeaderboardType } from "@/services/discord/leaderboard/types";
import { type ButtonInteraction, MessageFlags } from "discord.js";

export const pattern = "leaderboard:*";

function parseCustomId(customId: string): {
  action: string;
  type: LeaderboardType;
} | null {
  const [, action, type] = customId.split(":");

  if (!action || !type || !isValidLeaderboardType(type)) {
    return null;
  }

  return { action, type };
}

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, type } = parsed;

  if (action === "refresh") {
    await handleRefresh(interaction, type);
  } else {
    await interaction.reply({
      content: "Unknown action",
      flags: MessageFlags.Ephemeral,
    });
  }
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

  try {
    const result = await leaderboardService.refresh(type, true);

    if (!result.success) {
      throw new Error(result.error || "Unknown error");
    }

    logger.info(`${interaction.user.tag} refreshed ${type} leaderboard`);
  } catch (error) {
    logger.error("Failed to refresh leaderboard:", error);

    await replyError(
      interaction,
      "Refresh Failed",
      "Failed to refresh the leaderboard. Please try again later.",
    );
  }
}
