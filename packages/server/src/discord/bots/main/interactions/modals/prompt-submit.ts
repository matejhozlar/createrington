import { type ModalSubmitInteraction, MessageFlags } from "discord.js";
import { getServiceSync, Services } from "@/services";

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

  const message = await service.submitResponse({
    promptId: parsed.promptId,
    discordId: interaction.user.id,
    responseText,
  });

  await interaction.reply({
    content: message,
    flags: MessageFlags.Ephemeral,
  });
}
