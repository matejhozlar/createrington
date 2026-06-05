import config from "@/config";

const { GREEN, RED, ORANGE, BLUE, GRAY, PURPLE, GOLD } =
  config.discord.embeds.colors;

/**
 * Semantic accent-color palette for Components V2 containers.
 * Values are plain integers, matching `ComponentContainer.accentColor`.
 */
export const ComponentColors = {
  Neutral: GRAY,
  Success: GREEN,
  Error: RED,
  Warning: ORANGE,
  Info: BLUE,
  Loading: GRAY,
  System: PURPLE,
  Premium: GOLD,
} as const;
