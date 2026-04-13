import { waitlist, waitlistRepo } from "@/db";
import { isAdmin } from "@/discord/utils/admin-guard";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type GuildMember,
  MessageFlags,
} from "discord.js";

/**
 * Disables all non-link buttons in the message components
 *
 * @param interaction - The button interaction containing the message to modify
 * @returns New action rows with non-link buttons disabled
 * @private
 */
function disableNonLinkButtons(
  interaction: ButtonInteraction,
): ActionRowBuilder<ButtonBuilder>[] {
  return interaction.message.components.map((row) => {
    const newRow = new ActionRowBuilder<ButtonBuilder>();
    if ("components" in row) {
      row.components.forEach((component) => {
        if (component.type === 2) {
          const button = ButtonBuilder.from(component);
          if (button.data.style !== ButtonStyle.Link) {
            button.setDisabled(true);
          }
          newRow.addComponents(button);
        }
      });
    }
    return newRow;
  });
}

/**
 * Parses the waitlist button customId (format: waitlist:action:id)
 *
 * @param customId - The button's customId string
 * @returns Parsed action and id, or null if invalid
 * @private
 */
function parseCustomId(customId: string): {
  action: "accept" | "decline";
  id: string;
} | null {
  const [, action, id] = customId.split(":");

  if (!action || !id) return null;
  if (action !== "accept" && action !== "decline") return null;

  return { action, id };
}

/**
 * Waitlist button handler
 *
 * Handles buttons with pattern: waitlist:accept:<id> or waitlist:decline<id>
 */
export const pattern = "waitlist:*";

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

  return isAdmin(member);
}

/**
 * Routes waitlist button interactions to accept or decline handlers
 *
 * On accept: sends an invite email (if email exists) and enables progress tracking.
 * On decline: marks the entry as declined and disables buttons.
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

  const parsedId = parseInt(id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const entry = await waitlist.entry.get({ id: parsedId });

    if (action === "accept") {
      if (
        entry.status === "accepted" ||
        entry.status === "auto_accepted" ||
        entry.inviteCode
      ) {
        await interaction.editReply(`⚠️ This user has already been invited`);
        return;
      }

      await waitlistRepo.manualInvite(parsedId, interaction.user.id);

      const replyMessage = entry.email
        ? `✅ Invite sent successfully to ${entry.email}. Progress tracking is now active!`
        : `✅ Entry accepted (no email on file). Progress tracking is now active!`;
      await interaction.editReply(replyMessage);

      logger.info(`Waitlist entry ${id} accepted by ${interaction.user.tag}`);
    } else if (action === "decline") {
      if (entry.status === "declined") {
        await interaction.editReply(`⚠️ This user has already been declined`);
        return;
      }

      await waitlist.entry.update(
        { id: parsedId },
        {
          status: "declined",
          acceptedBy: interaction.user.id,
          acceptedAt: new Date(),
          email: null,
        },
      );
      await interaction.message.edit({
        components: disableNonLinkButtons(interaction),
        content: `❌ Declined by <@${interaction.user.id}>`,
        embeds: interaction.message.embeds,
      });

      await interaction.editReply("Declined");
      logger.info(`Waitlist entry ${id} declined by ${interaction.user.tag}`);
    } else {
      await interaction.editReply("Unknown action.");
    }
  } catch (error) {
    logger.error(`Error handling waitlist button (${action}:${id}):`, error);

    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("There was an error handling that action");
      }
    } catch (error) {
      logger.error("Failed to send error response:", error);
    }
  }
}
