import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { runRegistration } from "@/discord/bots/main/registration/run-registration";
import {
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Fallback slash command — primary registration flow is the button + modal in
 * the verification channel. Kept here so power users can still bypass the UI.
 */
export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Register to Createrington")
  .addStringOption((option) =>
    option
      .setName("mc_name")
      .setDescription("Your exact Minecraft username (case doesn't matter)")
      .setRequired(true),
  );

export const cooldown = {
  duration: 60,
  type: CooldownType.USER,
  message: "Please wait before trying to register again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const mcName = interaction.options.getString("mc_name", true);
  const member = await interaction.guild!.members.fetch(interaction.user.id);

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    const embed = EmbedPresets.errorWithAdmin(
      "Registration Failed",
      "Could not verify your roles. Please try again.",
    );
    await interaction.reply({ embeds: [embed.build()] });
    return;
  }

  if (!member.roles.cache.has(Discord.Roles.UNVERIFIED)) {
    const embed = EmbedPresets.error(
      "Already Registered",
      "You are already verified or not eligible to register",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const channel = (interaction.channel ?? null) as GuildTextBasedChannel | null;

  await runRegistration({
    member,
    discordId: interaction.user.id,
    userTag: interaction.user.tag,
    username: interaction.user.username,
    mcName,
    channel,
    render: async ({ embeds, components }) => {
      await interaction.editReply({
        embeds: embeds.map((e) => e.build()),
        components: components ?? [],
      });
    },
  });
}
