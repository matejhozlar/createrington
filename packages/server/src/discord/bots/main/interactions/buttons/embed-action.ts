import { Q } from "@/db";
import {
  ChannelType,
  type ButtonInteraction,
  MessageFlags,
  channelMention,
  userMention,
} from "discord.js";
import type { EmbedActionButton } from "@createrington/shared/api/embed";
import type { ButtonModule } from "@/discord/bots/common/loaders/component-loader";
import { CustomIds } from "@/discord/custom-ids";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;

function applyTemplate(
  template: string,
  userId: string,
  username: string,
): string {
  return template
    .replace(/\{user\}/g, userMention(userId))
    .replace(/\{username\}/g, username)
    .replace(
      /\{date\}/g,
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
}

async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = CustomIds.embedAction.parse(interaction.customId);
  const presetId = Number(parsed?.presetId);
  const buttonIndex = Number(parsed?.buttonIndex);

  if (!Number.isInteger(presetId) || !Number.isInteger(buttonIndex)) {
    await interaction.reply({
      content: "Invalid button.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const preset = await Q.discord.embed.preset.find({ id: presetId });
  if (!preset) {
    await interaction.reply({
      content: "This button's configuration no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const data = preset.data as { actionButtons?: EmbedActionButton[] };
  const actionButton = data.actionButtons?.[buttonIndex];

  if (!actionButton) {
    await interaction.reply({
      content: "This button's action could not be found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const now = Date.now();
  const lastUsed = cooldowns.get(interaction.user.id);
  if (lastUsed && now - lastUsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000);
    await interaction.reply({
      content: `Please wait ${remaining}s before using this button again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  cooldowns.set(interaction.user.id, now);

  if (actionButton.action === "create_thread") {
    await handleCreateThread(interaction, actionButton);
  }
}

async function handleCreateThread(
  interaction: ButtonInteraction,
  config: EmbedActionButton,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({
      content: "This button only works in a server.",
    });
    return;
  }

  const targetChannel = await guild.channels
    .fetch(config.channelId)
    .catch(() => null);

  if (!targetChannel) {
    await interaction.editReply({
      content: "The target channel for this action no longer exists.",
    });
    return;
  }

  const userId = interaction.user.id;
  const member = interaction.member as { displayName?: string } | null;
  const username = member?.displayName ?? interaction.user.displayName;

  const threadName = applyTemplate(config.threadName, userId, username).slice(
    0,
    100,
  );
  const threadMessage = applyTemplate(config.threadMessage, userId, username);

  if (
    targetChannel.type === ChannelType.GuildText ||
    targetChannel.type === ChannelType.GuildAnnouncement
  ) {
    const textChannel = targetChannel;
    const thread = await textChannel.threads.create({
      name: threadName,
      reason: `Created by embed action button (user: ${interaction.user.tag})`,
    });

    await thread.send(threadMessage);

    await interaction.editReply({
      content: `Thread created: ${channelMention(thread.id)}`,
    });

    logger.info(
      `Embed action: created thread "${threadName}" in #${textChannel.name} for ${interaction.user.tag}`,
    );
  } else if (targetChannel.type === ChannelType.GuildForum) {
    const thread = await targetChannel.threads.create({
      name: threadName,
      message: { content: threadMessage },
      reason: `Created by embed action button (user: ${interaction.user.tag})`,
    });

    await interaction.editReply({
      content: `Post created: ${channelMention(thread.id)}`,
    });

    logger.info(
      `Embed action: created forum post "${threadName}" in #${targetChannel.name} for ${interaction.user.tag}`,
    );
  } else {
    await interaction.editReply({
      content: "The target channel doesn't support threads.",
    });
  }
}

export default {
  customId: CustomIds.embedAction,
  execute,
} satisfies ButtonModule;
