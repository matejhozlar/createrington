/**
 * Embed accent colours
 *
 * Kept free of any environment dependency so pure rendering code (emoji
 * tinting, card generation) can share the palette without pulling in validated
 * config. Re-exported as `config.discord.embeds.colors`.
 */
export const EMBED_COLORS = {
  GREEN: 0x00ff00,
  RED: 0xff0000,
  BLUE: 0x0099ff,
  GOLD: 0xffd700,
  PURPLE: 0x9b59b6,
  ORANGE: 0xff8800,
  YELLOW: 0xffff00,
  CYAN: 0x00ffff,
  PINK: 0xff69b4,
  DARK_BLUE: 0x0066cc,
  DARK_GREEN: 0x008000,
  DARK_RED: 0x8b0000,
  DARK_PURPLE: 0x663399,
  DARK_GOLD: 0xb8860b,
  GRAY: 0x808080,
  DARK_GRAY: 0x404040,
  WHITE: 0xffffff,
  BLACK: 0x000000,
} as const;
