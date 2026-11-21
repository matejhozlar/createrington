import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("username")
  .setDescription("Retrieve user's Minecraft username")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to retrieve username for")
      .setRequired(true),
  );

const permissions: CommandPermissions = {
  requireAdmin: true,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  const username = await Q.player.select.minecraftUsername({
    discordId: user.id,
  });

  const embed = EmbedPresets.plain({
    description: `${username}`,
  });

  await interaction.reply({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
