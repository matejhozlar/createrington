import { waitlist, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";

/**
 * Checks if user is an admin (has admin role or is in admin database)
 */
async function isAdmin(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    return false;
  }

  const member = interaction.member;
  if (member && "roles" in member) {
    if (typeof member.roles !== "string" && !Array.isArray(member.roles)) {
      const hasAdminRole = member.roles.cache.has(Discord.Roles.ADMIN);
      if (hasAdminRole) return true;
    }
  }

  // TODO: Add database check
  return false;
}

/**
 * Disables all non-link buttons in the message components
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
 * Parses the waitlist button customId
 * Format: waitlist:action:id
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

export async function checkPermission(
  interaction: ButtonInteraction,
): Promise<boolean> {
  return isAdmin(interaction);
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

  const parsedId = parseInt(id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const entry = await waitlist.entry.get({ id: parsedId });

    if (action === "accept") {
      if (
        entry.status === "accepted" ||
        entry.status === "auto_accepted" ||
        entry.token
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
