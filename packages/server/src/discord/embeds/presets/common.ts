import { createEmbed } from "../embed-builder";
import { EmbedColors } from "../colors";
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
};
