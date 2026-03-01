import { env, envMode } from "./env/env.config";
import type {
  MemberRolesConfig,
  ChannelConfig,
  CategoriesConfig,
} from "./discord.types";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const discordEntitiesPath = path.join(__dirname, "./discord-entities.json");

interface DiscordEntities {
  roles: MemberRolesConfig;
  channels: ChannelConfig;
  categories: CategoriesConfig;
}

let discordEntities: DiscordEntities;
try {
  discordEntities = JSON.parse(fs.readFileSync(discordEntitiesPath, "utf-8"));
} catch (error) {
  console.warn(
    "Warning: discord-entities.json not found. Run 'npm run scrape-discord' to generate it.",
  );
  discordEntities = {
    roles: {} as MemberRolesConfig,
    channels: {} as ChannelConfig,
    categories: {} as CategoriesConfig,
  };
}

const config = {
  envMode,

  meta: {
    name: "Createrington",
    version: "1.21.1",
    author: {
      name: "saunhardy",
      email: "matejhozlarzadek8ii@gmail.com",
      discord: "matejhoz",
    },
    links: {
      discordInvite: "https://discord.gg/7PAptNgqk2",
      website: "https://create-rington.com",
      adminPanel: "https://create-rington.com/login-admin/",
      modpack: "https://www.curseforge.com/minecraft/modpacks/create-rington",
      map: "https://create-rington.com/blue-map",
      assets: "https://assets.create-rington.com",
    },
  },

  app: {
    port: env.PORT,
    auth: {
      accessToken: {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      refreshToken: {
        expiresInDays: env.REFRESH_TOKEN_EXPIRES_IN_DAYS,
      },
      cookie: {
        name: env.REFRESH_COOKIE_NAME,
      },
      allowedServerIps: {
        local: env.LOCAL_SERVER_IP_ADDRESS,
      },
    },
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
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    },
    monitoring: {
      intervalMs: 60_000,
      warnUtilizationPercent: 80,
    },
  },

  discord: {
    bots: {
      main: {
        id: env.DISCORD_MAIN_BOT_ID,
        token: env.DISCORD_MAIN_BOT_TOKEN,
        webbhook: {
          id: env.DISCORD_MAIN_BOT_WEBHOOK_ID,
        },
      },
      web: {
        id: env.DISCORD_WEB_BOT_ID,
        token: env.DISCORD_WEB_BOT_TOKEN,
      },
    },

    guild: {
      id: env.DISCORD_GUILD_ID,
      roles: discordEntities.roles,
      channels: discordEntities.channels,
      categories: discordEntities.categories,
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

    events: {
      onGuildMemberAdd: {
        welcome: {
          channelId: "1446998934428848238",
          enabled: true,
          imageConfig: {
            backgroundColor: "#2C2F33",
            accentColor: "#7289DA",
            textColor: "#FFFFFF",
            secondaryTextColor: "#99AA5B",
            backgroundImageURL:
              "https://market-assets.create-rington.com/welcome/welcome.png",
          },
        },
        autoRole: {
          roleId: "1447307459449327616",
          enabled: true,
        },
      },
    },

    oauth: {
      clientId: env.DISCORD_OAUTH_CLIENT_ID,
      clientSecret: env.DISCORD_OAUTH_CLIENT_SECRET,
      redirectUri:
        env.NODE_ENV === "production"
          ? env.DISCORD_OAUTH_REDIRECT_URI_PROD
          : env.DISCORD_OAUTH_REDIRECT_URI_DEV,
    },
  },

  servers: {
    cogs: {
      ip: env.COGS_AND_STEAM_SERVER_IP,
      port: env.COGS_AND_STEAM_SERVER_PORT,
      name: "Cogs & Steam",
      id: 1,
      rcon: {
        host: env.COGS_AND_STEAM_SERVER_IP,
        port: env.COGS_AND_STEAM_RCON_PORT,
        password: env.COGS_AND_STEAM_RCON_PASSWORD,
      },
      sftp: {
        host: env.COGS_AND_STEAM_SFTP_HOST,
        port: env.COGS_AND_STEAM_SFTP_PORT,
        username: env.COGS_AND_STEAM_SFTP_USER,
        password: env.COGS_AND_STEAM_SFTP_PASS,
        statsPath: env.COGS_AND_STEAM_SFTP_STATS_PATH,
      },
    },
    test: {
      ip: env.TEST_SERVER_IP,
      port: env.TEST_SERVER_PORT,
      name: "Test Server",
      id: 2,
      rcon: {
        host: env.TEST_SERVER_IP,
        port: env.TEST_RCON_PORT,
        password: env.TEST_RCON_PASSWORD,
      },
    },
    playerLimit: env.PLAYER_LIMIT,
  },

  email: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: {
      user: env.EMAIL_ADDRESS,
      pass: env.EMAIL_PASS,
    },
  },

  economy: {
    reward: {
      daily: 50,
    },
    lottery: {
      durationMs: 2 * 60 * 1000,
      minAmount: 10,
    },
  },
} as const;

export type Config = typeof config;

export default config;
