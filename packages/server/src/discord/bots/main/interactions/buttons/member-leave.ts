import { Q } from "@/db";
import { isAdmin } from "@/discord/utils/admin-guard";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { playerDeletionService } from "@/services/player/deletion";
import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

const permissionDeniedMessage = "You must be an admin to do that.";

async function checkPermission(
  interaction: ButtonInteraction,
): Promise<boolean> {
  return interaction.inCachedGuild() && (await isAdmin(interaction.member));
}

async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = CustomIds.departedDeleteNow.parse(interaction.customId);
  const departedId = Number(parsed?.departedId);

  if (!Number.isInteger(departedId)) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await handleDeleteNow(interaction, departedId);
}

async function handleDeleteNow(
  interaction: ButtonInteraction,
  departedId: number,
): Promise<void> {
  await interaction.deferUpdate();

  const departed = await Q.discord.guild.member.leave.find({
    id: departedId,
  });

  if (!departed) {
    await replyError(
      interaction,
      "Not Found",
      "This member has already been deleted or the record doesn't exist.",
    );

    return;
  }

  const admin = await Q.player.find({ discordId: interaction.user.id });
  const adminUsername = admin?.minecraftUsername ?? null;

  await playerDeletionService.delete(
    { minecraftUuid: departed.minecraftUuid },
    {
      actor: {
        type: "admin",
        discordId: interaction.user.id,
        username: adminUsername ?? "Unknown",
      },
      reason: "Departed member deleted via admin button",
    },
  );

  await Q.discord.guild.member.leave.update(
    { id: departedId },
    { deletedAt: new Date() },
  );

  const deletedEmbed = EmbedPresets.departed.deleted({
    minecraftUsername: departed.minecraftUsername,
    deletedBy: {
      discordId: interaction.user.id,
      username: adminUsername,
    },
    deletedAt: new Date(),
  });

  await interaction.message.edit({
    embeds: [deletedEmbed.build()],
    components: [],
  });

  logger.info(
    `Admin ${interaction.user.tag} deleted departed member ${departed.minecraftUsername}`,
  );

  const confirmEmbed = EmbedPresets.success(
    "Member Deleted",
    `Successfully removed **${departed.minecraftUsername}** from the system.`,
  );

  await interaction.followUp({
    embeds: [confirmEmbed.build()],
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  customId: CustomIds.departedDeleteNow,
  checkPermission,
  permissionDeniedMessage,
  execute,
} satisfies ButtonModule;
