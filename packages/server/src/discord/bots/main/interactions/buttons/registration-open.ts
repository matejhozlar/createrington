import type { ButtonInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { REGISTER_MODAL_INPUT_ID } from "@/discord/bots/main/registration/constants";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";
import { denyForeignVerificationChannel } from "@/discord/bots/main/registration/verification-channel";

async function execute(interaction: ButtonInteraction): Promise<void> {
  if (await denyForeignVerificationChannel(interaction)) return;

  const modal = new ModalBuilder()
    .setCustomId(CustomIds.registrationSubmit.build())
    .setTitle("Register your Minecraft account");

  const mcNameInput = new TextInputBuilder()
    .setCustomId(REGISTER_MODAL_INPUT_ID)
    .setLabel("Minecraft Username")
    .setPlaceholder("e.g. Steve")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(16)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(mcNameInput),
  );

  await interaction.showModal(modal);
}

export default {
  customId: CustomIds.registrationOpen,
  execute,
} satisfies ButtonModule;
