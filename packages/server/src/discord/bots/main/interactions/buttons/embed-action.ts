import { Q } from "@/db";
import {
  ChannelType,
  type ButtonInteraction,
  type TextChannel,
  type NewsChannel,
  MessageFlags,
} from "discord.js";
import type { EmbedActionButton } from "@createrington/shared/api/embed";

/**
 * Handles embed action buttons (e.g. "Create Thread")
 * Pattern: embed-action:*
 *
 * Custom ID format: embed-action:<presetId>:<buttonIndex>
 */
export const pattern = "embed-action:*";

export const prodOnly = false;

// Per-user cooldown: userId -> last click timestamp
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000; // 10 seconds between thread creations per user

function parseCustomId(customId: string): {
  presetId: number;
  buttonIndex: number;
} | null {
  const parts = customId.split(":");
  if (parts.length !== 3) return null;

  const presetId = parseInt(parts[1], 10);
  const buttonIndex = parseInt(parts[2], 10);

  if (isNaN(presetId) || isNaN(buttonIndex)) return null;
  return { presetId, buttonIndex };
}

function applyTemplate(
  template: string,
  userId: string,
  username: string,
): string {
  return template
    .replace(/\{user\}/g, `<@${userId}>`)
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

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: "Invalid button.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { presetId, buttonIndex } = parsed;

  // Load the preset to get the action config
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

  // Rate limit per user
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

  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ content: "This button only works in a server." });
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
    const username = interaction.user.displayName;

    // Truncate to 100 chars (Discord thread name limit) after template substitution
    const threadName = applyTemplate(config.threadName, userId, username).slice(0, 100);
    const threadMessage = applyTemplate(
      config.threadMessage,
      userId,
      username,
    );

    // Create thread in the target channel
    if (
      targetChannel.type === ChannelType.GuildText ||
      targetChannel.type === ChannelType.GuildAnnouncement
    ) {
      const textChannel = targetChannel as TextChannel | NewsChannel;
      const thread = await textChannel.threads.create({
        name: threadName,
        reason: `Created by embed action button (user: ${interaction.user.tag})`,
      });

      await thread.send(threadMessage);

      await interaction.editReply({
        content: `Thread created: <#${thread.id}>`,
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
        content: `Post created: <#${thread.id}>`,
      });

      logger.info(
        `Embed action: created forum post "${threadName}" in #${targetChannel.name} for ${interaction.user.tag}`,
      );
    } else {
      await interaction.editReply({
        content: "The target channel doesn't support threads.",
      });
    }
  } catch (error) {
    logger.error("Failed to handle create_thread action:", error);
    await interaction.editReply({
      content: "Something went wrong while creating the thread. Please try again.",
    });
  }
}
