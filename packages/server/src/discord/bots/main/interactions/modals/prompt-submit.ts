import { type ModalSubmitInteraction, MessageFlags, time } from "discord.js";
import { getServiceSync, Services } from "@/services";

/**
 * Modal handler for player-prompt response submissions.
 *
 * customId shape: `prompt:submit:<promptId>`. The interaction-handler
 * registry matches wildcard-ending strings via `startsWith`, so we declare
 * the shared prefix here; the numeric id is parsed at execute time.
 */
export const customId = "prompt:submit:*";

function parseCustomId(raw: string): { promptId: number } | null {
  const [, , rawId] = raw.split(":");
  if (!rawId) return null;
  const promptId = parseInt(rawId, 10);
  if (!Number.isFinite(promptId)) return null;
  return { promptId };
}

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: "Invalid modal.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const responseText = interaction.fields.getTextInputValue("response").trim();

  if (!responseText) {
    await interaction.reply({
      content: "Please write a response before submitting.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);

  try {
    const { endsAt } = await service.submitResponse({
      promptId: parsed.promptId,
      discordId: interaction.user.id,
      responseText,
    });

    await interaction.reply({
      content: `Recorded. You can edit your response until ${time(endsAt, "R")}.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    await interaction.reply({
      content: `Couldn't record your response: ${message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
