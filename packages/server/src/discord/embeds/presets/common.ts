import { createEmbed } from "../embed-builder";
import { EmbedColors } from "../colors";
import { Discord } from "@/discord/constants";
import type { ColorResolvable } from "discord.js";

export const CommonEmbedPresets = {
  success(title: string, description?: string) {
    const embed = createEmbed().title(`✅ ${title}`).color(EmbedColors.Success);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  error(title: string, description?: string) {
    const embed = createEmbed().title(`❌ ${title}`).color(EmbedColors.Error);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  errorWithAdmin(title: string, description?: string) {
    const embed = createEmbed().title(`❌ ${title}`).color(EmbedColors.Error);

    const fullDescription = description
      ? `${description}\n\n If this issue persists, please contact ${Discord.Roles.mention(
          Discord.Roles.ADMIN,
        )}`
      : `If this issue persists, please contact ${Discord.Roles.mention(
          Discord.Roles.ADMIN,
        )}`;

    embed.description(fullDescription);

    return embed;
  },

  info(title: string, description?: string) {
    const embed = createEmbed().title(`ℹ️ ${title}`).color(EmbedColors.Info);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  plain(data: {
    description?: string;
    title?: string;
    color?: ColorResolvable;
  }) {
    const embed = createEmbed().color(EmbedColors.Info);

    if (data.title) {
      embed.title(data.title);
    }

    if (data.description) {
      embed.description(data.description);
    }

    if (data.color) {
      embed.color(data.color);
    }

    return embed;
  },

  loading(message: string = "Processing...") {
    return createEmbed()
      .title("⏳ Please wait")
      .description(message)
      .color(EmbedColors.Info);
  },

  channelDeletion() {
    const embed = createEmbed()
      .title("🗑️ Channel Deletion")
      .description("This channel will be deleted in few seconds...")
      .color(EmbedColors.Error);

    return embed;
  },
};
