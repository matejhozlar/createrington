import { getServiceSync, Services } from "@/services";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

async function execute(interaction: ButtonInteraction): Promise<void> {
  const promptId = Number(
    CustomIds.promptRespond.parse(interaction.customId)?.promptId,
  );
  if (!Number.isInteger(promptId)) {
    await interaction.reply({
      content: "Invalid button format.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const service = getServiceSync(Services.PLAYER_PROMPT_SERVICE);
  const decision = await service.prepareEntry(promptId, interaction.user.id);

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
    .setCustomId(CustomIds.promptSubmit.build({ promptId: prompt.id }))
    .setTitle(prompt.question.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );

  await interaction.showModal(modal);
}

export default {
  customId: CustomIds.promptRespond,
  execute,
} satisfies ButtonModule;
