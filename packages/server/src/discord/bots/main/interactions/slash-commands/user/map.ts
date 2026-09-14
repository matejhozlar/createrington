import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("map")
  .setDescription("Get a link to the live server map");

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait a moment before requesting the map link again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ButtonPresets.links.map(),
  );

  await interaction.reply({
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}
