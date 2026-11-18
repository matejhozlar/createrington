import { env, envMode } from "./env/env.config";
import type { LauncherChannel } from "@createrington/shared/launcher";
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
  discordEntities = JSON.parse(
    fs.readFileSync(discordEntitiesPath, "utf-8"),
  ) as DiscordEntities;
} catch {
  console.warn(
    "Warning: discord-entities.json not found. Run 'pnpm scrape-discord' to generate it.",
  );
  discordEntities = {
    roles: {} as MemberRolesConfig,
    channels: {} as ChannelConfig,
    categories: {} as CategoriesConfig,
  };
}

function deriveCookieName(base: string): string {
  if (!env.COOKIE_DOMAIN) return base;
  return envMode.isDevDeployment ? `${base}_dev` : base;
}

const storagePath = path.resolve(env.STORAGE_PATH);

const ASSETS_BASE_URL = "https://assets.createrington.com";
const ASSETS_VERSION = 2;

export function assetUrl(assetPath: string): string {
  return `${ASSETS_BASE_URL}/${assetPath.replace(/^[/]+/, "")}?v=${ASSETS_VERSION}`;
}

const config = {
  envMode,

  meta: {
    name: "Createrington",
    links: {
      discordInvite: "https://discord.gg/mtF6MDHj4Z",
      website: env.WEBSITE_URL,
      adminPanel: env.ADMIN_PANEL_URL,
      map: env.MAP_URL,
      vote: "https://www.createmodservers.com/server/createrington/vote",
    },
  },

  app: {
    version: env.APP_VERSION || "unknown",
    port: env.PORT,
    devClientOrigin: env.DEV_CLIENT_ORIGIN,
    auth: {
      accessToken: {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      modAccessToken: {
        secret: env.MOD_JWT_SECRET,
      },
      launcherAccessToken: {
        secret: env.LAUNCHER_JWT_SECRET ?? "",
      },
      refreshToken: {
        expiresInDays: env.REFRESH_TOKEN_EXPIRES_IN_DAYS,
      },
      cookie: {
        name: deriveCookieName(env.REFRESH_COOKIE_NAME),
        accessName: deriveCookieName(env.ACCESS_COOKIE_NAME),
        domain: env.COOKIE_DOMAIN || undefined,
      },
      sso: {
        callbackUrl: env.SSO_CALLBACK_URL,
        corsOrigins: env.SSO_CORS_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        codeExchangeOrigins: env.SSO_CODE_EXCHANGE_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      owner: {
        discordId: env.OWNER_DISCORD_ID,
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
      statement_timeout: 30_000,
      query_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    },
  },

  discord: {
    bots: {
      main: {
        id: env.DISCORD_MAIN_BOT_ID,
        token: env.DISCORD_MAIN_BOT_TOKEN,
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
          channelId: discordEntities.channels.createringtonOfficial?.welcome,
          enabled: true,
          backgroundImageUrls: [
            assetUrl("welcome/dark-warehouse.webp"),
            assetUrl("welcome/gondola-station.webp"),
            assetUrl("welcome/high-speed-train.webp"),
            assetUrl("welcome/metro.webp"),
            assetUrl("welcome/mountains-train-station.webp"),
            assetUrl("welcome/royal-albert-hall.webp"),
            assetUrl("welcome/space-station.webp"),
          ],
        },
        autoRole: {
          roleId: discordEntities.roles.unverified,
          enabled: true,
        },
      },
    },

    oauth: {
      clientId: env.DISCORD_MAIN_BOT_ID,
      clientSecret: env.DISCORD_MAIN_BOT_CLIENT_SECRET,
      redirectUri: env.DISCORD_OAUTH_REDIRECT_URI,
    },
  },

  servers: {
    rails: {
      ip: env.RAILS_N_SAILS_SERVER_IP,
      port: env.RAILS_N_SAILS_SERVER_PORT,
      name: "Rails 'n Sails",
      slug: "rails",
      id: 1,
      rcon: {
        host: env.RAILS_N_SAILS_SERVER_IP,
        port: env.RAILS_N_SAILS_RCON_PORT,
        password: env.RAILS_N_SAILS_RCON_PASSWORD ?? "",
      },
      sftp: {
        host: env.RAILS_N_SAILS_SFTP_HOST ?? "",
        port: env.RAILS_N_SAILS_SFTP_PORT ?? 22,
        username: env.RAILS_N_SAILS_SFTP_USER ?? "",
        password: env.RAILS_N_SAILS_SFTP_PASS ?? "",
        statsPath: env.RAILS_N_SAILS_SFTP_STATS_PATH ?? "",
      },
    },
    playerLimit: env.PLAYER_LIMIT,
  },

  mcServer: {
    localPath: env.MC_SERVER_LOCAL_PATH ?? null,
  },

  sync: {
    targetUrl: env.PLAYTIME_SYNC_TARGET_URL,
    secret: env.PLAYTIME_SYNC_SECRET,
  },

  launcher: {
    available: !envMode.isProductionDeployment,
    channel: (envMode.isDevDeployment
      ? "staging"
      : "production") satisfies LauncherChannel,
    publishTokenHash: env.LAUNCHER_PUBLISH_TOKEN_HASH ?? "",
    downloadHosts: env.LAUNCHER_DOWNLOAD_HOSTS.split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0),
    packFiles: {
      internalUrl:
        env.LAUNCHER_PACK_FILES_INTERNAL_URL?.replace(/\/+$/, "") ?? null,
    },
  },

  internal: {
    secret: env.INTERNAL_API_SHARED_SECRET ?? "",
  },

  ai: {
    openai: {
      apiKey: env.OPENAI_API_KEY ?? "",
      defaultModel: env.OPENAI_DEFAULT_MODEL,
    },
    get enabled() {
      return Boolean(this.openai.apiKey);
    },
  },

  redis: {
    url: env.REDIS_URL ?? null,
  },

  votifier:
    env.VOTIFIER_PORT && env.VOTIFIER_TOKEN
      ? {
          host: env.VOTIFIER_HOST,
          port: env.VOTIFIER_PORT,
          token: env.VOTIFIER_TOKEN,
        }
      : null,

  contentGateway:
    env.CONTENT_GATEWAY_URL && env.CONTENT_GATEWAY_TOKEN
      ? { url: env.CONTENT_GATEWAY_URL, token: env.CONTENT_GATEWAY_TOKEN }
      : null,

  curseforge: {
    defaultGameVersion: "1.21.1",
    modpackProjectId: env.CURSEFORGE_MODPACK_PROJECT_ID,
    modpackCacheTtlMs: 60 * 60 * 1000,
    modpackIncompleteCacheTtlMs: 60 * 1000,
  },

  sandbox: {
    serviceToken: env.SANDBOX_SERVICE_TOKEN ?? null,
  },

  adminChat: {
    url: env.CLAUDE_API_URL,
    secret: env.ADMIN_CHAT_SECRET,
  },

  email: {
    apiKey: env.RESEND_API_KEY ?? "",
    fromEmail: env.RESEND_FROM_EMAIL,
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  storage: {
    path: storagePath,
  },

  gallery: {
    intakeChannelId:
      discordEntities.channels.createringtonOfficial?.gallerySubmissions,
    announcementChannelId:
      discordEntities.channels.createringtonOfficial?.gallery,
    originalsDir: path.join(storagePath, "gallery", "originals"),
  },

  puppeteer: {
    secret: env.PUPPETEER_SECRET ?? "",
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    baseUrl:
      env.PUPPETEER_BASE_URL ??
      (envMode.isDev ? env.DEV_CLIENT_ORIGIN : `http://127.0.0.1:${env.PORT}`),
  },

  skinApi: {
    baseUrl: env.SKIN_API_URL ?? "http://127.0.0.1:8788/internal",
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    get enabled() {
      return Boolean(this.secretKey && this.webhookSecret);
    },
  },

  r2: {
    accountId: env.R2_ACCOUNT_ID ?? "",
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: env.R2_BUCKET ?? "",
    publicUrl: (env.R2_PUBLIC_URL ?? "").replace(/[/]+$/, ""),
    get enabled() {
      return Boolean(
        this.accountId &&
        this.accessKeyId &&
        this.secretAccessKey &&
        this.bucket &&
        this.publicUrl,
      );
    },
  },
} as const;

export default config;
