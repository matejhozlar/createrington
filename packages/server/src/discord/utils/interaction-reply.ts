import { EmbedPresets } from "@/discord/embeds";
import { MessageFlags, type RepliableInteraction } from "discord.js";

/**
 * Sends a standard error embed in response to an interaction, choosing the
 * delivery method that matches the interaction's current state: an edit of a
 * deferred placeholder, a follow-up after an existing reply, or a fresh reply.
 * `ephemeral` (default true) applies to fresh replies and follow-ups; a
 * deferred reply keeps the ephemeral flag chosen when it was deferred.
 */
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
