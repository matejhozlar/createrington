import { Discord } from "@/discord/constants";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { runRegistration } from "@/discord/bots/main/registration/run-registration";
import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandCooldown,
  CommandModule,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Register to Createrington")
  .addStringOption((option) =>
    option
      .setName("mc_name")
      .setDescription("Your exact Minecraft username (case doesn't matter)")
      .setMinLength(3)
      .setMaxLength(16)
      .setRequired(true),
  );

const cooldown: CommandCooldown = {
  duration: 60,
  type: CooldownType.USER,
  message: "Please wait before trying to register again!",
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const mcName = interaction.options.getString("mc_name", true);

  if (!interaction.inCachedGuild()) {
    const { components, flags } = RegistrationComponentPresets.errorWithAdmin(
      "Registration Failed",
      "Registration only works inside the server.",
    );
    await interaction.reply({ components, flags });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!member.roles.cache.has(Discord.Roles.UNVERIFIED)) {
    await replyError(
      interaction,
      "Already Registered",
      "You are already verified or not eligible to register",
    );
    return;
  }

  await interaction.deferReply();

  const channel = interaction.channel;

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

export default {
  data,
  cooldown,
  execute,
} satisfies CommandModule;
