import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { InteractionError } from "@/discord/utils/interaction-error";
import { replyError } from "@/discord/utils/interaction-reply";
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
import type {
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
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

const permissions: CommandPermissions = {
  requireAdmin: true,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  const leaderboardService = await getService(Services.LEADERBOARD_SERVICE);

  if (subcommand === "create") {
    await handleCreate(interaction, leaderboardService);
  } else if (subcommand === "refresh") {
    await handleRefresh(interaction, leaderboardService);
  } else if (subcommand === "refresh-all") {
    await handleRefreshAll(interaction, leaderboardService);
  }
}

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

async function handleRefresh(
  interaction: ChatInputCommandInteraction,
  leaderboardService: LeaderboardService,
): Promise<void> {
  const type = interaction.options.getString("type", true) as LeaderboardType;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const posted = await Q.leaderboard.message.find({ leaderboardType: type });
  if (!posted) {
    await replyError(
      interaction,
      "No Leaderboard",
      `There is no ${type} leaderboard yet. Run \`/leaderboard create\` to post one.`,
    );
    return;
  }

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
    throw new InteractionError(
      "Refresh Failed",
      `Could not refresh the ${type} leaderboard. If its message was deleted, run \`/leaderboard create\` to post a new one.`,
      { cause: new Error(result.error ?? "Leaderboard refresh failed") },
    );
  }
}

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

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
