import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import type { InactivityCleanupService } from "@/services/discord/cleanup/inactivity/inactivity-cleanup.service";
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

  try {
    let service: InactivityCleanupService;
    try {
      service = await getService(Services.INACTIVITY_CLEANUP_SERVICE);
    } catch {
      await replyError(
        interaction,
        "Service Unavailable",
        "The inactivity cleanup service only runs on the production deployment.",
      );
      return;
    }

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
  } catch (error) {
    logger.error("/force-inactivity-cleanup failed:", error);

    await replyError(
      interaction,
      "Cleanup Failed",
      error instanceof Error ? error.message : "An unknown error occurred",
    );
  }
}
