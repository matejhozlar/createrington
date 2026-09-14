import { player } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { CooldownType } from "@/discord/utils/cooldown";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  escapeMarkdown,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("vote")
  .setDescription("Get your personal link to vote for the server");

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait a moment before requesting another vote link!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const voter = await player.find({ discordId: interaction.user.id });
  if (!voter) {
    await replyError(
      interaction,
      "Not Registered",
      "You must be registered to vote. Use `/register` to get started.",
    );
    return;
  }

  const embed = EmbedPresets.info(
    "Vote for Createrington",
    `Your vote link is prefilled for **${escapeMarkdown(voter.minecraftUsername)}**. Thanks for supporting the server!`,
  ).build();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ButtonPresets.links.vote(voter.minecraftUsername),
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}
