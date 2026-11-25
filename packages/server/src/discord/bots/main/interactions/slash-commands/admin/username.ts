import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyNotRegistered } from "@/discord/utils/interaction-reply";
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

  const player = await Q.player.find(
    { discordId: user.id },
    { select: ["minecraftUsername"] },
  );
  if (!player) {
    await replyNotRegistered(interaction, user);
    return;
  }

  const embed = EmbedPresets.plain({
    description: player.minecraftUsername,
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
