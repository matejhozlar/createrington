import { Q } from "@/db";
import { isAdmin } from "@/discord/utils/admin-guard";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { playerDeletionService } from "@/services/player/deletion";
import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";

export const pattern = "departed:*";

export const permissionDeniedMessage = "You must be an admin to do that.";

export async function checkPermission(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const member = interaction.member as GuildMember | null;

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    return false;
  }

  return await isAdmin(member);
}

function parseCustomId(customId: string): {
  action: string;
  id: string;
} | null {
  const [, action, id] = customId.split(":");
  if (!action || !id) return null;
  return { action, id };
}

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { action, id } = parsed;
  const departedId = parseInt(id);

  if (action === "delete-now") {
    await handleDeleteNow(interaction, departedId);
  } else {
    await interaction.reply({
      content: "Unknown action",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleDeleteNow(
  interaction: ButtonInteraction,
  departedId: number,
): Promise<void> {
  await interaction.deferUpdate();

  try {
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
  } catch (error) {
    logger.error("Failed to delete departed member:", error);

    await replyError(
      interaction,
      "Deletion Failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
