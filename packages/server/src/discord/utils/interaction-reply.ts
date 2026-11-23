import { EmbedPresets } from "@/discord/embeds";
import {
  escapeMarkdown,
  MessageFlags,
  type RepliableInteraction,
  type User,
} from "discord.js";

export async function replyError(
  interaction: RepliableInteraction,
  title: string,
  description?: string,
  options?: { ephemeral?: boolean },
): Promise<void> {
  const ephemeral = options?.ephemeral ?? true;
  const embeds = [EmbedPresets.error(title, description).build()];

  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ embeds });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({
      embeds,
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
    return;
  }

  await interaction.reply({
    embeds,
    flags: ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}

export async function replyNotRegistered(
  interaction: RepliableInteraction,
  user: User,
  options?: { ephemeral?: boolean },
): Promise<void> {
  await replyError(
    interaction,
    "Not Registered",
    `${escapeMarkdown(user.displayName)} is not registered.`,
    options,
  );
}
