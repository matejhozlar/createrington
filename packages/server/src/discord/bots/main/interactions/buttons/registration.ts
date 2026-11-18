import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { CLOSE_GRACE_MS } from "@/discord/bots/main/registration-cleanup";
import { Discord } from "@/discord/constants";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  type ButtonInteraction,
  type GuildChannel,
  MessageFlags,
} from "discord.js";

export const pattern = "registration:*";

function parseCustomId(customId: string): { action: string } | null {
  const [, action] = customId.split(":");
  if (!action) return null;
  return { action };
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

  const { action } = parsed;

  if (action === "close") {
    const channel = interaction.channel;

    if (!channel || !isSendableChannel(channel) || channel.isDMBased()) {
      await interaction.reply({
        content: "❌ Channel not found or invalid",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildChannel = channel as GuildChannel & { name: string };
    const channelName = guildChannel.name;

    if (guildChannel.parentId !== Discord.Categories.VERIFICATION) {
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
}
