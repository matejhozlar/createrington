import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import { getTopRoleRules } from "@/services/discord/role/config";
import type { TopRoleResult } from "@/services/discord/role/role-management.service";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const ROLE_CHOICES = getTopRoleRules().map((rule) => ({
  name: rule.label,
  value: rule.gameRankId,
}));

export const data = new SlashCommandBuilder()
  .setName("force-update")
  .setDescription("Force an automatic update to run now")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("roles")
      .setDescription(
        "Recalculate the top-1 roles now: all of them, or just one",
      )
      .addStringOption((opt) =>
        opt
          .setName("role")
          .setDescription("Role to recalculate (leave empty for all)")
          .setRequired(false)
          .addChoices(...ROLE_CHOICES),
      ),
  );

export const permissions = {
  requireOwner: true,
};

function outcome(result: TopRoleResult): string {
  if (result.failed) {
    const reason = result.failureReason ? ` (${result.failureReason})` : "";
    return result.holder
      ? `could not be given to **${result.holder}**${reason}`
      : `could not be recalculated${reason}`;
  }
  if (!result.holder) return "no eligible player";
  if (result.assigned) return `now held by **${result.holder}**`;
  return `still held by **${result.holder}**`;
}

async function handleRoles(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const selected = interaction.options.getString("role");
  const rule = getTopRoleRules().find((r) => r.gameRankId === selected);

  if (selected && !rule) {
    await replyError(
      interaction,
      "Unknown Role",
      "That role is not a top-1 role.",
    );
    return;
  }

  const service = await getService(Services.ROLE_MANAGEMENT_SERVICE);
  const results = await service.recalculateTopRoles(
    rule ? [rule.roleId] : undefined,
  );

  const summary = results
    .map((result) => `**${result.rule.label}**: ${outcome(result)}`)
    .join("\n");

  const embed = results.some((result) => result.failed)
    ? EmbedPresets.error("Top Roles Recalculated With Errors", summary)
    : EmbedPresets.success("Top Roles Recalculated", summary);

  await interaction.editReply({ embeds: [embed.build()] });

  logger.info(
    `${interaction.user.tag} forced a top role recalculation via /force-update roles (${rule?.label ?? "all"})`,
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "roles":
        await handleRoles(interaction);
        break;
      default:
        logger.warn(`/force-update got an unhandled subcommand: ${subcommand}`);
        await replyError(
          interaction,
          "Unknown Subcommand",
          `\`${subcommand}\` is not something /force-update can run.`,
        );
    }
  } catch (error) {
    logger.error(`/force-update ${subcommand} failed:`, error);

    await replyError(
      interaction,
      "Update Failed",
      error instanceof Error ? error.message : "An unknown error occurred",
    );
  }
}
