import config from "@/config";
import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("force-inactivity-cleanup")
  .setDescription(
    "Force-run the inactivity cleanup cycle now and reset its 7-day schedule",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const permissions = {
  requireOwner: true,
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!config.envMode.isProductionDeployment) {
    await replyError(
      interaction,
      "Service Unavailable",
      "The inactivity cleanup service only runs on the production deployment.",
    );
    return;
  }

  const service = await getService(Services.INACTIVITY_CLEANUP_SERVICE);

  const player = await Q.player.find({ discordId: interaction.user.id });

  await service.forceRunAndResetSchedule({
    discordId: interaction.user.id,
    username: player?.minecraftUsername ?? null,
  });

  const embed = EmbedPresets.success(
    "Inactivity Cleanup Triggered",
    "Full cycle completed (resolve → warn → remove). The 7-day schedule has been reset.",
  );
  await interaction.editReply({ embeds: [embed.build()] });

  logger.info(
    `${interaction.user.tag} force-triggered inactivity cleanup via /force-inactivity-cleanup`,
  );
}
