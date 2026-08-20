import { Q, waitlistRepo } from "@/db";
import { waitlistService } from "@/services/waitlist/waitlist.service";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { denyForeignVerificationChannel } from "@/discord/bots/main/registration/verification-channel";
import {
  WaitlistComponentPresets,
  WAITLIST_JOIN_BUTTON_ID,
  WAITLIST_LEAVE_BUTTON_ID,
  WAITLIST_REFRESH_BUTTON_ID,
} from "@/discord/components/presets/waitlist";
import { MessageFlags, type ButtonInteraction } from "discord.js";

/**
 * Waitlist button handler for the member-facing queue cards inside
 * verification channels: join the queue, refresh the position, leave the
 * queue. Legacy admin accept/decline buttons answer with a pointer to the
 * admin panel.
 */
export const pattern = "waitlist:*";

export const prodOnly = false;

async function renderCurrentState(
  interaction: ButtonInteraction,
): Promise<void> {
  const discordId = interaction.user.id;
  const memberMention = `<@${discordId}>`;

  const entry = await Q.waitlist.entry.find({ discordId });

  if (!entry || entry.status === "expired") {
    const hasCapacity = await waitlistRepo.hasCapacity();
    const card = hasCapacity
      ? RegistrationComponentPresets.idle({ memberMention })
      : entry
        ? WaitlistComponentPresets.left({ memberMention })
        : WaitlistComponentPresets.queueOffer({ memberMention });
    await interaction.editReply({
      components: card.components,
      flags: card.flags,
    });
    return;
  }

  if (entry.status === "queued") {
    const { position, total } =
      await waitlistService.getQueuePosition(discordId);
    const card = WaitlistComponentPresets.waiting({
      memberMention,
      position,
      total,
      queuedAt: entry.queuedAt,
    });
    await interaction.editReply({
      components: card.components,
      flags: card.flags,
    });
    return;
  }

  const card = RegistrationComponentPresets.idle({ memberMention });
  await interaction.editReply({
    components: card.components,
    flags: card.flags,
  });
}

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const discordId = interaction.user.id;

  try {
    if (await denyForeignVerificationChannel(interaction)) return;

    switch (interaction.customId) {
      case WAITLIST_JOIN_BUTTON_ID: {
        await interaction.deferUpdate();

        const hasCapacity = await waitlistRepo.hasCapacity();
        if (!hasCapacity) {
          await waitlistService.joinQueue({
            discordId,
            discordUsername: interaction.user.username,
            verifyChannelId: interaction.channelId,
            waitingMessageId: interaction.message.id,
          });
        }

        await renderCurrentState(interaction);
        return;
      }

      case WAITLIST_REFRESH_BUTTON_ID: {
        await interaction.deferUpdate();
        await renderCurrentState(interaction);
        return;
      }

      case WAITLIST_LEAVE_BUTTON_ID: {
        await interaction.deferUpdate();
        await waitlistService.leaveQueue(discordId);
        await renderCurrentState(interaction);
        return;
      }

      default: {
        await interaction.reply({
          content:
            "This action has moved to the admin panel and is no longer available here.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  } catch (error) {
    logger.error(
      `Error handling waitlist button (${interaction.customId}) for ${interaction.user.tag}:`,
      error,
    );

    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.followUp({
          content: "There was an error handling that action. Please try again.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (followUpError) {
      logger.error("Failed to send error response:", followUpError);
    }
  }
}
