import { type ModalSubmitInteraction, MessageFlags } from "discord.js";
import { getServiceSync, Services } from "@/services";

/**
 * Modal handler for player-prompt response submissions.
 *
 * customId shape: `prompt:submit:<promptId>`. The interaction-handler
 * registry matches wildcard-ending strings via `startsWith`, so we declare
 * the shared prefix here; the numeric id is parsed at execute time.
 * PlayerPromptService re-checks the entry rules and hands back the exact
 * ephemeral copy to echo, so a stale modal can't outrun a cap or cooldown.
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
    const message = await service.submitResponse({
      promptId: parsed.promptId,
      discordId: interaction.user.id,
      responseText,
    });

    await interaction.reply({
      content: message,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(
      `Failed to record response for prompt #${parsed.promptId}:`,
      error,
    );
    await interaction.reply({
      content: "Couldn't record your response. Please try again in a moment.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
