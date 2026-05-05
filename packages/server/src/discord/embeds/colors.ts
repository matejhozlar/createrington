import config from "@/config";

const { GREEN, RED, ORANGE, BLUE, GRAY, PURPLE, GOLD } =
  config.discord.embeds.colors;

/** Semantic color palette for Discord embeds, mapped from config hex values */
export const EmbedColors = {
  Neutral: GRAY,
  Success: GREEN,
  Error: RED,
  Warning: ORANGE,
  Info: BLUE,
  Loading: GRAY,
  System: PURPLE,
  Premium: GOLD,
} as const;
