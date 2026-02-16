import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("skin")
  .setDescription("Display a player's Minecraft skin")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to check")
      .setRequired(false),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking skins again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const userOption = interaction.options.getUser("user", false);
  const targetUser = userOption || interaction.user;

  try {
    const player = await Q.player.get({ discordId: targetUser.id });

    const embed = EmbedPresets.info(`${player.minecraftUsername}'s Skin`)
      .image(
        `https://mc-heads.net/body/${player.minecraftUuid}`,
      )
      .build();

    await interaction.reply({ embeds: [embed] });
  } catch {
    const embed = EmbedPresets.error(
      "Lookup Error",
      `Could not find player data for ${targetUser.displayName}. They may not be registered.`,
    );

    await interaction.reply({ embeds: [embed.build()] });
  }
}
