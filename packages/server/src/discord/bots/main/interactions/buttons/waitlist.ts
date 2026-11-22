import { Q } from "@/db";
import { waitlistCapacityService } from "@/services/waitlist/capacity.service";
import { waitlistService } from "@/services/waitlist/waitlist.service";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { denyForeignVerificationChannel } from "@/discord/bots/main/registration/verification-channel";
import { WaitlistComponentPresets } from "@/discord/components/presets/waitlist";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";
import { MessageFlags, type ButtonInteraction, userMention } from "discord.js";

async function renderCurrentState(
  interaction: ButtonInteraction,
): Promise<void> {
  const discordId = interaction.user.id;
  const memberMention = userMention(discordId);

  const entry = await Q.waitlist.entry.find({ discordId });

  if (!entry || entry.status === "expired") {
    const hasCapacity = await waitlistCapacityService.hasCapacity();
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

async function execute(interaction: ButtonInteraction): Promise<void> {
  const discordId = interaction.user.id;

  if (await denyForeignVerificationChannel(interaction)) return;

  switch (CustomIds.waitlist.parse(interaction.customId)?.action) {
    case "join": {
      await interaction.deferUpdate();

      const hasCapacity = await waitlistCapacityService.hasCapacity();
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

    case "refresh": {
      await interaction.deferUpdate();
      await renderCurrentState(interaction);
      return;
    }

    case "leave": {
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
}

export default {
  customId: CustomIds.waitlist,
  execute,
} satisfies ButtonModule;
