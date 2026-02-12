import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { getService, Services } from "@/services";
import {
  getAllLeaderboardTypes,
  type LeaderboardService,
  type LeaderboardType,
} from "@/services/discord/leaderboard";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the leaderboard command
 * Admin-only command to manually manage leaderboard operations
 */
export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Manage leaderboards")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create or update leaderboard")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Leaderboard type")
          .setRequired(true)
          .addChoices(
            ...getAllLeaderboardTypes().map((type) => ({
              name: type.charAt(0).toUpperCase() + type.slice(1),
              value: type,
            })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("refresh")
      .setDescription("Manually refresh leaderboard")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Leaderboard type")
          .setRequired(true)
          .addChoices(
            ...getAllLeaderboardTypes().map((type) => ({
              name: type.charAt(0).toUpperCase() + type.slice(1),
              value: type,
            })),
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("refresh-all").setDescription("Refresh all leaderboards"),
  );

/**
 * Permission configuration for the leaderboard command
 * Requires administrator privileges to execute
 */
export const permissions = {
  requireAdmin: true,
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development environments
 */

/**
 * Executes the leaderboard command to manually manage leaderboards
 *
 * Process:
 * 1. Routes to the appropriate subcommand handler based on user selection
 * 2. For "create" subcommand:
 *    - Creates a new leaderboard message or updates existing one
 *    - Sends ephemeral confirmation with channel mention
 * 3. For "refresh" subcommand:
 *    - Manually refreshes a specific leaderboard type
 *    - Updates lastManualRefresh timestamp for cooldown tracking
 *    - Shows success message with entry count
 * 4. For "refresh-all" subcommand:
 *    - Refreshes all registered leaderboard types
 *    - Shows summary of successful/failed refreshes
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 *
 * @remarks
 * - All responses are ephemeral (only visible to command user)
 * - Manual refreshes via this command trigger user cooldowns
 * - Errors are caught and displayed with appropriate error embeds
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  const leaderboardService = await getService(
    Services.LEADERBOARD_SERVICE,
  );

  try {
    if (subcommand === "create") {
      await handleCreate(interaction, leaderboardService);
    } else if (subcommand === "refresh") {
      await handleRefresh(interaction, leaderboardService);
    } else if (subcommand === "refresh-all") {
      await handleRefreshAll(interaction, leaderboardService);
    }
  } catch (error) {
    logger.error("/leaderboard failed:", error);

    const embed = EmbedPresets.error(
      "Command Failed",
      error instanceof Error ? error.message : "An unknown error occurred",
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        embeds: [embed.build()],
      });
    }
  }
}

/**
 * Handles the "create" subcommand to create or update a leaderboard
 *
 * Workflow:
 * 1. Defers reply to prevent interaction timeout
 * 2. Calls leaderboardService to create/update the message
 * 3. If message exists, updates it with fresh data
 * 4. If message doesn't exist, creates new one in configured channel
 * 5. Shows success message with channel mention
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the leaderboard is created/updated
 */
async function handleCreate(
  interaction: ChatInputCommandInteraction,
  leaderboardService: LeaderboardService,
): Promise<void> {
  const type = interaction.options.getString("type", true) as LeaderboardType;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await leaderboardService.createOrUpdate(type);

  const embed = EmbedPresets.success(
    "Leaderboard Created",
    `Created ${type} leaderboard in ${Discord.Channels.mention(
      result.channelId,
    )}`,
  );

  await interaction.editReply({
    embeds: [embed.build()],
  });
}

/**
 * Handles the "refresh" subcommand to manually refresh a specific leaderboard
 *
 * Workflow:
 * 1. Defers reply to prevent interaction timeout
 * 2. Calls leaderboardService with isManual=true flag
 * 3. Fetches fresh data from database
 * 4. Updates the leaderboard message
 * 5. Updates lastManualRefresh timestamp (triggers cooldown)
 * 6. Shows success message with entry count
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the leaderboard is refreshed
 * @throws Error if refresh fails or leaderboard message not found
 */
async function handleRefresh(
  interaction: ChatInputCommandInteraction,
  leaderboardService: LeaderboardService,
): Promise<void> {
  const type = interaction.options.getString("type", true) as LeaderboardType;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await leaderboardService.refresh(type);

  if (result.success) {
    const embed = EmbedPresets.success(
      "Leaderboard Refreshed",
      `Successfully refreshed ${type} leaderboard with ${result.entries.length} entries.`,
    );

    await interaction.editReply({
      embeds: [embed.build()],
    });
  } else {
    throw new Error(result.error || "Unknown error");
  }
}

/**
 * Handles the "refresh-all" subcommand to refresh all leaderboards
 *
 * Workflow:
 * 1. Defers reply to prevent interaction timeout
 * 2. Calls leaderboardService.refreshAll() to refresh all types
 * 3. Collects success/failure results for each leaderboard
 * 4. Shows summary with counts and any failure details
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when all leaderboards are refreshed
 *
 * @remarks
 * - Refreshes are executed in parallel for efficiency
 * - Partial failures are allowed (some can succeed while others fail)
 * - Failed leaderboards are listed with error messages
 */
async function handleRefreshAll(
  interaction: ChatInputCommandInteraction,
  leaderboardService: LeaderboardService,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const results = await leaderboardService.refreshAll();

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  const embed = EmbedPresets.success(
    "Leaderboards Refreshed",
    `Successfully refreshed ${successful}/${results.length} leaderboards.`,
  );

  if (failed.length > 0) {
    embed.field(
      "Failed",
      failed.map((r) => `- ${r.type}: ${r.error}`).join("\n"),
    );
  }

  await interaction.editReply({
    embeds: [embed.build()],
  });
}
