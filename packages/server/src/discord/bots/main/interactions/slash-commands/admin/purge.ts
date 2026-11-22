import { EmbedPresets } from "@/discord/embeds";
import { pluralize } from "@/utils/format";
import { replyError } from "@/discord/utils/interaction-reply";
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
  .setName("purge")
  .setDescription("Purge up to 100 recent messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName("count")
      .setDescription("Number of messages to purge (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Only purge messages from this user")
      .setRequired(false),
  );

const permissions: CommandPermissions = {
  requireAdmin: true,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const count = interaction.options.getInteger("count", true);
  const targetUser = interaction.options.getUser("user");

  if (!interaction.channel || !("bulkDelete" in interaction.channel)) {
    await replyError(
      interaction,
      "Invalid channel",
      "This command can only be used in text channels.",
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let deletedMessages;

  if (targetUser) {
    const fetched = await interaction.channel.messages.fetch({
      limit: count,
    });
    const filtered = fetched.filter((m) => m.author.id === targetUser.id);
    deletedMessages = await interaction.channel.bulkDelete(filtered, true);
  } else {
    deletedMessages = await interaction.channel.bulkDelete(count, true);
  }

  const userSuffix = targetUser ? ` from ${targetUser.tag}` : "";

  const embed = EmbedPresets.success(
    "Messages purged",
    `Successfully purged **${deletedMessages.size}** ${pluralize(deletedMessages.size, "message")}${userSuffix}.`,
  );

  await interaction.editReply({
    embeds: [embed.build()],
  });

  logger.info(
    `${interaction.user.tag} purged ${deletedMessages.size} messages${userSuffix} in ${interaction.channel.name}`,
  );
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
