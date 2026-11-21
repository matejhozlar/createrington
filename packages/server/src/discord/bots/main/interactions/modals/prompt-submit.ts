import { type ModalSubmitInteraction, MessageFlags } from "discord.js";
import { getServiceSync, Services } from "@/services";
import type { ModalModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

async function execute(interaction: ModalSubmitInteraction): Promise<void> {
  const promptId = Number(
    CustomIds.promptSubmit.parse(interaction.customId)?.promptId,
  );
  if (!Number.isInteger(promptId)) {
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
    promptId,
    discordId: interaction.user.id,
    responseText,
  });

  await interaction.reply({
    content: message,
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  customId: CustomIds.promptSubmit,
  execute,
} satisfies ModalModule;
