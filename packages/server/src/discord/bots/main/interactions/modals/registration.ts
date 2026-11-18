import type { ModalSubmitInteraction } from "discord.js";
import { runRegistration } from "@/discord/bots/main/registration/run-registration";
import {
  REGISTER_MODAL_ID,
  REGISTER_MODAL_INPUT_ID,
} from "@/discord/bots/main/registration/constants";

export const customId = REGISTER_MODAL_ID;

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const mcName = interaction.fields
    .getTextInputValue(REGISTER_MODAL_INPUT_ID)
    .trim();

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "This can only be used inside the server.",
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  await interaction.deferUpdate();

  const channel = interaction.channel ?? null;

  await runRegistration({
    member,
    discordId: interaction.user.id,
    userTag: interaction.user.tag,
    username: interaction.user.username,
    mcName,
    channel,
    render: async ({ components, flags }) => {
      await interaction.editReply({
        components,
        flags,
        content: null,
        embeds: [],
      });
    },
  });
}
