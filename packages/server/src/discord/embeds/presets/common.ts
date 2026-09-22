import { createEmbed } from "../embed-builder";
import { EmbedColors } from "../colors";
import { Discord } from "@/discord/constants";
import type { ColorResolvable } from "discord.js";
import { appEmoji } from "@/discord/emojis";

/** Reusable embed presets for common response patterns (success, error, info, loading) */
export const CommonEmbedPresets = {
  /** Creates a green success embed */
  success(title: string, description?: string) {
    const embed = createEmbed()
      .title(`${appEmoji("check")} ${title}`)
      .color(EmbedColors.Success);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  /** Creates a red error embed */
  error(title: string, description?: string) {
    const embed = createEmbed()
      .title(`${appEmoji("cross")} ${title}`)
      .color(EmbedColors.Error);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  /** Creates a red error embed with an admin contact prompt appended */
  errorWithAdmin(title: string, description?: string) {
    const embed = createEmbed()
      .title(`${appEmoji("cross")} ${title}`)
      .color(EmbedColors.Error);

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

  /** Creates a blue info embed */
  info(title: string, description?: string) {
    const embed = createEmbed()
      .title(`${appEmoji("info")} ${title}`)
      .color(EmbedColors.Info);

    if (description) {
      embed.description(description);
    }

    return embed;
  },

  /** Creates a plain embed with optional title, description, and color overrides */
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

  /** Creates a loading/processing embed */
  loading(message: string = "Processing...") {
    return createEmbed()
      .title(`${appEmoji("hourglass")} Please wait`)
      .description(message)
      .color(EmbedColors.Info);
  },
};
