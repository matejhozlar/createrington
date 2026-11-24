import { Q } from "@/db";
import { isAdmin } from "@/discord/utils/admin-guard";
import { EmbedPresets } from "@/discord/embeds";
import { playerDeletionService } from "@/services/player/deletion";
import {
  cancelDeparture,
  checkDeparture,
  type CancelReason,
} from "@/services/discord/cleanup/member/departure";
import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

const permissionDeniedMessage = "You must be an admin to do that.";

const CANCEL_MESSAGES: Record<CancelReason, (username: string) => string> = {
  returned: (username) =>
    `**${username}** is back in the Discord server, so they were not deleted.`,
  relinked: (username) =>
    `**${username}** is now registered to a different Discord account, so they were not deleted.`,
};

async function followUpEmbed(
  interaction: ButtonInteraction,
  kind: "error" | "info",
  title: string,
  description: string,
): Promise<void> {
  await interaction.followUp({
    embeds: [EmbedPresets[kind](title, description).build()],
    flags: MessageFlags.Ephemeral,
  });
}

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

  if (!departed || departed.deletedAt) {
    await followUpEmbed(
      interaction,
      "error",
      "Not Found",
      "This member has already been deleted, returned, or the record doesn't exist.",
    );
    return;
  }

  const check = await checkDeparture(departed);

  if (check.action === "unavailable") {
    await followUpEmbed(
      interaction,
      "error",
      "Discord Unavailable",
      "Could not confirm the member is still gone from Discord. Try again in a moment.",
    );
    return;
  }

  if (check.action === "cancel") {
    await cancelDeparture(departed, check.reason);
    await followUpEmbed(
      interaction,
      "info",
      "Departure Cancelled",
      CANCEL_MESSAGES[check.reason](departed.minecraftUsername),
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
      ignoreMissing: true,
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
