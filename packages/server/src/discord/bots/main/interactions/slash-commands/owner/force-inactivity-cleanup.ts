import { EmbedPresets } from "@/discord/embeds";
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
      const embed = EmbedPresets.error(
        "Service Unavailable",
        "The inactivity cleanup service only runs on the production deployment.",
      );
      await interaction.editReply({ embeds: [embed.build()] });
      return;
    }

    await service.forceRunAndResetSchedule();

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

    const embed = EmbedPresets.error(
      "Cleanup Failed",
      error instanceof Error ? error.message : "An unknown error occurred",
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({ embeds: [embed.build()] });
    }
  }
}
