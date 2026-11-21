import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { CLOSE_GRACE_MS } from "@/discord/bots/main/registration-cleanup";
import { Discord } from "@/discord/constants";
import { isGuildTextChannel } from "@/discord/utils/channel-guard";
import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

async function execute(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel;

  if (!isGuildTextChannel(channel)) {
    await interaction.reply({
      content: "❌ Channel not found or invalid",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelName = channel.name;

  if (channel.parentId !== Discord.Categories.VERIFICATION) {
    logger.warn(
      `User ${interaction.user.tag} clicked registration close outside the verification category (channel: ${channelName})`,
    );
    await interaction.reply({
      content: "❌ This button only works in a registration channel",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const closing = RegistrationComponentPresets.closing();

  try {
    await interaction.update({
      components: closing.components,
      flags: closing.flags,
      content: null,
      embeds: [],
    });
  } catch (error) {
    logger.error("Failed to render the registration closing card:", error);
    await interaction.deferUpdate().catch(() => {});
  }

  setTimeout(() => {
    channel
      .delete(`Registration completed - closed by ${interaction.user.tag}`)
      .then(
        () => {
          logger.info(
            `Deleted registration channel ${channelName} - closed by ${interaction.user.tag}`,
          );
        },
        (error: unknown) => {
          logger.error("Failed to delete registration channel:", error);
        },
      );
  }, CLOSE_GRACE_MS);
}

export default {
  customId: CustomIds.registrationClose,
  execute,
} satisfies ButtonModule;
