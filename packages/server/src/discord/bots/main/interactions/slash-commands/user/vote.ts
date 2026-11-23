import { Q } from "@/db";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { CooldownType } from "@/discord/utils/cooldown";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandCooldown,
  CommandModule,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("vote")
  .setDescription("Get your personal link to vote for the server");

const cooldown: CommandCooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait a moment before requesting another vote link!",
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const voter = await Q.player.find({ discordId: interaction.user.id });
  if (!voter) {
    await replyError(
      interaction,
      "Not Registered",
      "You must be registered to vote. Use `/register` to get started.",
    );
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ButtonPresets.links.vote(voter.minecraftUsername),
  );

  await interaction.reply({
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  data,
  cooldown,
  execute,
} satisfies CommandModule;
