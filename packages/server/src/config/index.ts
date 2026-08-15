/**
 * Centralized application configuration
 *
 * Aggregates all environment-validated settings, Discord entities,
 * and static configuration into a single frozen config object.
 *
 * NOTE: Discord entity data (roles, channels, categories) is loaded from
 * a generated JSON file. Run `pnpm scrape-discord` to regenerate it.
 */

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

// Suffix only the dev deployment so prod and dev sharing a parent-domain
// cookie jar (e.g. both scoped to `.createrington.com`) can't overwrite
// each other's refresh cookies and trigger the family-detection
// theft-revoke storm. Prod keeps the legacy unsuffixed name so external
// SSO consumers that hardcode `crt_access` / `crt_refresh` keep working.
function deriveCookieName(base: string): string {
  if (!env.COOKIE_DOMAIN) return base;
  return envMode.isDevDeployment ? `${base}_dev` : base;
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
      discordInvite: "https://discord.gg/mtF6MDHj4Z",
      website: env.WEBSITE_URL,
      adminPanel: env.ADMIN_PANEL_URL,
      modpack:
        "https://www.curseforge.com/minecraft/modpacks/createrington-cogs-steam",
      map: env.MAP_URL,
      assets: env.ASSETS_URL,
    },
  },

  app: {
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
      refreshToken: {
        expiresInDays: env.REFRESH_TOKEN_EXPIRES_IN_DAYS,
      },
      cookie: {
        name: deriveCookieName(env.REFRESH_COOKIE_NAME),
        accessName: deriveCookieName(env.ACCESS_COOKIE_NAME),
        // Empty string means host-only (single-domain) cookies (the existing
        // behavior). Set to a parent domain (e.g. ".createrington.com") to
        // enable cross-subdomain SSO consumers.
        domain: env.COOKIE_DOMAIN || undefined,
      },
      sso: {
        callbackUrl: env.SSO_CALLBACK_URL ?? "",
        // Defensive `??` because in VALIDATION_MODE=generation (used by tests
        // and codegen) env vars bypass zod and arrive as raw process.env values
        // (undefined when unset).
        corsOrigins: (env.SSO_CORS_ORIGINS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        codeExchangeOrigins: (env.SSO_CODE_EXCHANGE_ORIGINS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      allowedServerIps: {
        local: env.LOCAL_SERVER_IP_ADDRESS,
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
      // Postgres aborts any single statement that exceeds 30s. Without this,
      // a runaway query (or a heavy attacker-triggered $ilike scan) can hold
      // a connection from the pool of 20 indefinitely and wedge the app.
      statement_timeout: 30_000,
      // Node-pg client-side mirror of statement_timeout, in case the server
      // doesn't enforce it for some reason.
      query_timeout: 30_000,
      // Postgres kills any transaction left idle for over 60s, releasing
      // its row locks. Protects against code paths that BEGIN but forget
      // to COMMIT/ROLLBACK on an error.
      idle_in_transaction_session_timeout: 60_000,
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
        webhook: {
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
          channelId: discordEntities.channels.createringtonOfficial?.welcome,
          enabled: true,
          backgroundImageUrls: [
            "https://assets.createrington.com/welcome/dark-warehouse.webp",
            "https://assets.createrington.com/welcome/gondola-station.webp",
            "https://assets.createrington.com/welcome/high-speed-train.webp",
            "https://assets.createrington.com/welcome/metro.webp",
            "https://assets.createrington.com/welcome/mountains-train-station.webp",
            "https://assets.createrington.com/welcome/royal-albert-hall.webp",
            "https://assets.createrington.com/welcome/space-station.webp",
          ],
        },
        autoRole: {
          roleId: discordEntities.roles.unverified,
          enabled: true,
        },
      },
    },

    oauth: {
      clientId: env.DISCORD_OAUTH_CLIENT_ID,
      clientSecret: env.DISCORD_OAUTH_CLIENT_SECRET,
      // Real prod requires DISCORD_OAUTH_REDIRECT_URI_PROD via the env
      // superRefine. The fallback to the dev URI exists for the dev
      // deployment case (NODE_ENV=production on dev.createrington.com),
      // which skips the superRefine and uses dev OAuth credentials.
      redirectUri:
        env.NODE_ENV === "production"
          ? (env.DISCORD_OAUTH_REDIRECT_URI_PROD ??
            env.DISCORD_OAUTH_REDIRECT_URI_DEV)
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
        password: env.COGS_AND_STEAM_RCON_PASSWORD ?? "",
      },
      // SFTP is gated behind isSftpAllowed() (services/mc-server/file-ops.ts);
      // empty defaults are fine because dev never opens the connection.
      sftp: {
        host: env.COGS_AND_STEAM_SFTP_HOST ?? "",
        port: env.COGS_AND_STEAM_SFTP_PORT ?? 22,
        username: env.COGS_AND_STEAM_SFTP_USER ?? "",
        password: env.COGS_AND_STEAM_SFTP_PASS ?? "",
        statsPath: env.COGS_AND_STEAM_SFTP_STATS_PATH ?? "",
      },
    },
    nomads: {
      ip: env.NOMADS_SERVER_IP,
      port: env.NOMADS_SERVER_PORT,
      name: "Nomads",
      rcon: {
        host: env.NOMADS_SERVER_IP,
        port: env.NOMADS_RCON_PORT,
        password: env.NOMADS_RCON_PASSWORD,
      },
    },
    playerLimit: env.PLAYER_LIMIT,
  },

  // null means SFTP is used (production path); a non-null value enables local filesystem ops
  mcServer: {
    localPath: env.MC_SERVER_LOCAL_PATH ?? null,
  },

  sync: {
    targetUrl: env.PLAYTIME_SYNC_TARGET_URL,
    secret: env.PLAYTIME_SYNC_SECRET,
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

  curseforge: {
    apiKey: env.CURSEFORGE_API_KEY,
    apiBaseUrl: "https://api.curseforge.com",
    defaultGameVersion: "1.21.1",
    modpackProjectId: env.CURSEFORGE_MODPACK_PROJECT_ID,
    modpackCacheTtlMs: 60 * 60 * 1000,
  },

  email: {
    apiKey: env.RESEND_API_KEY ?? "",
    fromEmail: env.RESEND_FROM_EMAIL,
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  storage: {
    // Resolved against CWD so relative paths work predictably across the
    // dev server (runs from repo root) and prod (runs from /opt/...).
    // Empty string when validation is skipped (generate scripts, unit tests)
    // since no consumer that needs the path runs in those modes.
    path: env.STORAGE_PATH ? path.resolve(env.STORAGE_PATH) : "",
  },

  puppeteer: {
    // Empty when not configured (dev). Render routes reject requests with an
    // empty secret (app/features/render/render.routes.ts).
    secret: env.PUPPETEER_SECRET ?? "",
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    // Default points the headless browser at loopback so the render
    // endpoints can enforce loopback-only access. Dev uses the Vite host
    // because Vite serves the client and proxies /api/* without XFF;
    // prod uses Node directly (it serves the SPA via the catch-all in
    // app/index.ts) so no public hostname or reverse proxy is involved.
    baseUrl:
      env.PUPPETEER_BASE_URL ??
      (envMode.isDev ? env.DEV_CLIENT_ORIGIN : `http://127.0.0.1:${env.PORT}`),
  },

  skinApi: {
    baseUrl: env.SKIN_API_URL ?? "http://127.0.0.1:8787",
    apiKey: env.SKIN_API_KEY ?? "",
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    get enabled() {
      return Boolean(this.secretKey && this.webhookSecret);
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
