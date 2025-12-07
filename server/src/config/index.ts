import type { Config } from "./types";
import { env, envMode } from "./env/env.config";

const config: Config = {
  envMode,

  app: {
    port: env.PORT,
  },

  utils: {
    logger: {
      logDir: "logs",
      keepDays: 7,
    },
  },

  database: {
    pool: {
      user: env.DB_USER,
      host: env.DB_HOST,
      database: env.DB_DATABASE,
      password: env.DB_PASSWORD,
      port: env.DB_PORT,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    },
  },

  discord: {
    bots: {
      main: {
        id: env.DISCORD_BOT_ID,
        token: env.DISCORD_BOT_TOKEN,
      },
    },
    guild: {
      id: env.DISCORD_GUILD_ID,
    },
    embeds: {
      colors: {
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
      },
    },
  },
} as const;

export default config;
