import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { getOptionalService, Services } from "@/services";
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
  .setName("force-inactivity-cleanup")
  .setDescription(
    "Force-run the inactivity cleanup cycle now and reset its 7-day schedule",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const permissions: CommandPermissions = {
  requireOwner: true,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const service = await getOptionalService(Services.INACTIVITY_CLEANUP_SERVICE);
  if (!service) {
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
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
