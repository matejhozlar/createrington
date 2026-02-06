import { Q } from "@/db";
import { isAdminDb } from "@/db/utils";
import { EmbedPresets } from "@/discord/embeds";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import { type ButtonInteraction, MessageFlags } from "discord.js";

/**
 * Handles departed member management buttons
 * Pattern: departed:*
 */
export const pattern = "departed:*";

/**
 * Whether these buttons should be handled in production only
 */
export const prodOnly = false;

export const permissionDeniedMessage = "You must be an admin to do that.";

/**
 * Permission check - requires admin role
 */
export async function checkPermission(
  interaction: ButtonInteraction,
): Promise<boolean> {
  return await isAdminDb(interaction.user.id);
}

/**
 * Parses the button customId
 */
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
      const embed = EmbedPresets.error(
        "Not Found",
        "This member has already been deleted or the record doesn't exist.",
      );

      await interaction.followUp({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await Q.player.delete({ minecraftUuid: departed.minecraftUuid });

    try {
      await minecraftRcon.whitelist(
        1,
        WhitelistAction.REMOVE,
        departed.minecraftUsername,
      );
    } catch (error) {
      logger.error(
        `Failed to remove ${departed.minecraftUsername} from whitelist:`,
        error,
      );
    }

    await Q.discord.guild.member.leave.update(
      { id: departedId },
      { deletedAt: new Date() },
    );

    const deletedEmbed = EmbedPresets.departed.deleted({
      minecraftUsername: departed.minecraftUsername,
      deletedBy: interaction.user.tag,
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

    const embed = EmbedPresets.error(
      "Deletion Failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    await interaction.followUp({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
