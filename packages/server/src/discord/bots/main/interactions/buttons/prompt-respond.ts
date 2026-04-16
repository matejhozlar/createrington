import { Q } from "@/db";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/**
 * Button handler for player-prompt "Respond" buttons.
 *
 * Pattern: `prompt:respond:<promptId>` — opens a modal prefilled with the
 * user's existing response (if any) so submitting overwrites rather than
 * creating a second row. The actual write happens in the modal handler at
 * interactions/modals/prompt-submit.ts; this file's only job is to validate
 * that the prompt is still open and to surface a friendly modal.
 */
export const pattern = "prompt:respond:*";

export const prodOnly = false;

function parseCustomId(customId: string): { promptId: number } | null {
  const [, , rawId] = customId.split(":");
  if (!rawId) return null;
  const promptId = parseInt(rawId, 10);
  if (!Number.isFinite(promptId)) return null;
  return { promptId };
}

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: "Invalid button format.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { promptId } = parsed;
  const prompt = await Q.player.prompt.find({ id: promptId });

  if (!prompt) {
    await interaction.reply({
      content: "That prompt no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (prompt.status !== "active" || prompt.endsAt.getTime() <= Date.now()) {
    await interaction.reply({
      content: "This prompt is closed — responses are no longer accepted.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Prefill with the user's existing response so clicking Respond twice
  // edits instead of forcing them to retype from memory.
  const existing = await Q.player.prompt.response.findByPromptAndDiscordId(
    promptId,
    interaction.user.id,
  );

  const input = new TextInputBuilder()
    .setCustomId("response")
    .setLabel("Your answer")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  if (existing?.responseText) {
    input.setValue(existing.responseText);
  }

  const modal = new ModalBuilder()
    .setCustomId(`prompt:submit:${promptId}`)
    .setTitle(prompt.question.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );

  await interaction.showModal(modal);
}
