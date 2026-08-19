import type { ButtonInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  REGISTER_MODAL_ID,
  REGISTER_MODAL_INPUT_ID,
} from "@/discord/bots/main/registration/constants";
import { REGISTER_BUTTON_ID } from "@/discord/components/presets/registration";

/** Opens the registration modal when the applicant clicks the welcome button. */
export const pattern = REGISTER_BUTTON_ID;

export const prodOnly = false;

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(REGISTER_MODAL_ID)
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
