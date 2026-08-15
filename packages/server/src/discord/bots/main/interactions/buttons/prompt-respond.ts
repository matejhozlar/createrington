import { getServiceSync, Services } from "@/services";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/**
 * Button handler for player-prompt "Respond" / "Add entry" buttons.
 *
 * Pattern: `prompt:respond:<promptId>`. PlayerPromptService decides whether
 * the click earns a modal and what it should hold: single-entry prompts
 * prefill the existing answer so submitting overwrites it, multi-entry
 * prompts open blank unless the cap or cooldown blocks them. The actual
 * write happens in the modal handler at interactions/modals/prompt-submit.ts.
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

  const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);
  const decision = await service.prepareEntry(
    parsed.promptId,
    interaction.user.id,
  );

  if (!decision.allowed) {
    await interaction.reply({
      content: decision.message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { prompt, prefill, entryNumber } = decision;

  const input = new TextInputBuilder()
    .setCustomId("response")
    .setLabel(
      prompt.entryMode === "multi" ? `Entry #${entryNumber}` : "Your answer",
    )
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  if (prefill) {
    input.setValue(prefill);
  }

  const modal = new ModalBuilder()
    .setCustomId(`prompt:submit:${prompt.id}`)
    .setTitle(prompt.question.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );

  await interaction.showModal(modal);
}
