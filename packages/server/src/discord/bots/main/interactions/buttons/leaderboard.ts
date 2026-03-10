import { EmbedPresets } from "@/discord/embeds";
import { getService, Services } from "@/services";
import { isValidLeaderboardType } from "@/services/discord/leaderboard/config";
import type { LeaderboardType } from "@/services/discord/leaderboard/types";
import { type ButtonInteraction, MessageFlags } from "discord.js";

/**
 * Handles leaderboard-related buttons
 * Pattern: leaderboard:*
 */
export const pattern = "leaderboard:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

/**
 * Parses the leaderboard button customId (format: leaderboard:action:type)
 *
 * @param customId - The button's customId string
 * @returns Parsed action and leaderboard type, or null if invalid
 * @private
 */
function parseCustomId(customId: string): {
  action: string;
  type: LeaderboardType;
} | null {
  const [, action, type] = customId.split(":");

  if (!action || !type || !isValidLeaderboardType(type)) {
    return null;
  }

  return { action, type: type as LeaderboardType };
}

/**
 * Main execution handler for leaderboard button interactions
 *
 * Routes button clicks to the appropriate handler based on the action.
 * Currently supports:
 * - refresh: Manually refresh leaderboard data
 *
 * @param interaction - The button interaction to handle
 * Button interaction flow:
 * 1. User clicks "Refresh" button on leaderboard
 * 2. Custom ID is parsed (e.g., "leaderboard:refresh:playtime")
 * 3. Routed to handleRefresh()
 * 4. Cooldown check performed
 * 5. Leaderboard data refreshed if allowed
 */
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

/**
 * Handles manual leaderboard refresh requests from users
 *
 * Workflow:
 * 1. Checks if refresh is allowed (1-hour cooldown)
 * 2. If on cooldown, shows remaining time
 * 3. If allowed, defers update and refreshes data
 * 4. Updates the leaderboard message with fresh data
 * 5. Updates lastManualRefresh timestamp for cooldown tracking
 *
 * @param interaction - The button interaction
 * @param type - The leaderboard type to refresh
 *
 * @remarks
 * - Manual refreshes have a 1-hour cooldown per leaderboard type
 * - Automatic scheduled refreshes do not trigger this cooldown
 * - Uses deferUpdate() to keep the original message intact
 * - Errors are shown as ephemeral follow-up messages
 */
async function handleRefresh(
  interaction: ButtonInteraction,
  type: LeaderboardType,
): Promise<void> {
  const leaderboardService = await getService(
    Services.LEADERBOARD_SERVICE,
  );
  const cooldownCheck = await leaderboardService.canRefresh(type);

  if (!cooldownCheck.canRefresh) {
    const expiresAt = cooldownCheck.lastRefreshed!.getTime() + 60 * 60 * 1000;
    const unixTimestamp = Math.floor(expiresAt / 1000);

    const embed = EmbedPresets.error(
      "Leaderboard on Cooldown",
      `This leaderboard can be refreshed <t:${unixTimestamp}:R>.`,
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
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

    const embed = EmbedPresets.error(
      "Refresh Failed",
      "Failed to refresh the leaderboard. Please try again later.",
    );

    await interaction.followUp({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
