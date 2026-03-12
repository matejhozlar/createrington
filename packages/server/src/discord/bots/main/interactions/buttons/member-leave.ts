import { Q } from "@/db";
import { isAdmin } from "@/discord/utils/admin-guard";
import { EmbedPresets } from "@/discord/embeds";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";

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
 * Permission check - requires admin role or database admin
 *
 * @param interaction - The button interaction to check permissions for
 * @returns True if the user has admin privileges
 */
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

/**
 * Parses the departed member button customId (format: departed:action:id)
 *
 * @param customId - The button's customId string
 * @returns Parsed action and record id, or null if invalid
 * @private
 */
function parseCustomId(customId: string): {
  action: string;
  id: string;
} | null {
  const [, action, id] = customId.split(":");
  if (!action || !id) return null;
  return { action, id };
}

/**
 * Routes departed member button interactions to the appropriate handler
 *
 * @param interaction - The button interaction from Discord
 */
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

/**
 * Handles immediate deletion of a departed member's data
 *
 * Removes the player from the database, revokes their whitelist entry,
 * and updates the notification embed to reflect the deletion.
 *
 * @param interaction - The button interaction from Discord
 * @param departedId - Database ID of the departed member record
 * @private
 */
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
