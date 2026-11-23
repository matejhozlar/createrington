import dotenv from "dotenv";
import { z } from "zod";
import { DISCORD_ID_REGEX } from "@createrington/shared/discord-id";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_PATH = path.resolve(__dirname, "..", "..", "..", "..", "..");

dotenv.config({ path: path.join(ENV_PATH, ".env"), quiet: true });

const port = (label = "Port") =>
  z.coerce
    .number()
    .int()
    .min(1, `${label} must be at least 1`)
    .max(65535, `${label} must be between 1 and 65535`);

const ipv4 = (label = "IP") =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine(
      (ip) =>
        /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
        ip.split(".").every((o) => {
          const n = parseInt(o, 10);
          return n >= 0 && n <= 255;
        }),
      { message: `${label} must be a valid IPv4 address` },
    );

const DEV_FALLBACK_SERVER_IP = "0.0.0.0";

const discordId = (label = "ID") =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(/^\d+$/, `${label} must be numeric`);

const discordToken = (label = "Token") =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(/^[\w\-.]+$/, `${label} format is invalid`);

function isDevHostname(websiteUrl: string): boolean {
  try {
    const host = new URL(websiteUrl).hostname;
    return (
      host === "127.0.0.1" || host === "localhost" || host.startsWith("dev.")
    );
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    PORT: port("Server port").default(5001),
    NODE_ENV: z.enum(["development", "production", "test"], {
      message: "NODE_ENV must be set to development, production or test",
    }),
    APP_VERSION: z.string().optional(),

    DB_USER: z.string().min(1, "Database user is required"),
    DB_HOST: z.string().min(1, "Database host is required"),
    DB_DATABASE: z.string().min(1, "Database name is required"),
    DB_PASSWORD: z.string().min(1, "Database password is required"),
    DB_PORT: port("Database port").default(5432),

    RAILS_N_SAILS_SFTP_HOST: z.string().optional(),
    RAILS_N_SAILS_SFTP_PORT: port("Rails 'n Sails SFTP port").optional(),
    RAILS_N_SAILS_SFTP_USER: z.string().optional(),
    RAILS_N_SAILS_SFTP_PASS: z.string().optional(),
    RAILS_N_SAILS_SFTP_STATS_PATH: z.string().optional(),

    DISCORD_GUILD_ID: discordId("Guild ID"),
    DISCORD_MAIN_BOT_TOKEN: discordToken("Main bot token"),
    DISCORD_MAIN_BOT_ID: discordId("Main bot ID"),
    DISCORD_MAIN_BOT_CLIENT_SECRET: z
      .string()
      .min(32, "Main bot client secret must be at least 32 characters"),
    DISCORD_OAUTH_REDIRECT_URI: z
      .string()
      .url("OAuth redirect URI must be a valid URL"),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT access secret must be at least 32 characters"),
    MOD_JWT_SECRET: z
      .string()
      .min(32, "Mod JWT secret must be at least 32 characters"),
    LAUNCHER_JWT_SECRET: z
      .string()
      .min(32, "Launcher JWT secret must be at least 32 characters")
      .optional(),
    LAUNCHER_PUBLISH_TOKEN_HASH: z
      .string()
      .regex(
        /^[0-9a-f]{64}$/,
        "Launcher publish token hash must be a lowercase SHA-256 hex digest",
      )
      .optional(),
    LAUNCHER_DOWNLOAD_HOSTS: z.string().default(""),
    LAUNCHER_PACK_FILES_INTERNAL_URL: z.string().url().optional(),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(
        /^\d+[smhd]$/,
        "JWT_ACCESS_EXPIRES_IN must be in format: number + unit (s/m/h/d). Examples: 60s, 15m, 24h, 7d",
      )
      .default("15m"),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).default(30),
    REFRESH_COOKIE_NAME: z.string().default("crt_refresh"),
    ACCESS_COOKIE_NAME: z.string().default("crt_access"),
    COOKIE_DOMAIN: z.string().default(""),
    SSO_CALLBACK_URL: z.string().default(""),
    SSO_CORS_ORIGINS: z.string().default(""),
    SSO_CODE_EXCHANGE_ORIGINS: z.string().default(""),
    INTERNAL_API_SHARED_SECRET: z
      .string()
      .min(32, "Internal API shared secret must be at least 32 characters")
      .optional(),
    OWNER_DISCORD_ID: z
      .string()
      .regex(DISCORD_ID_REGEX, "OWNER_DISCORD_ID must be a Discord snowflake"),

    RAILS_N_SAILS_SERVER_IP: ipv4("Rails 'n Sails server IP").default(
      DEV_FALLBACK_SERVER_IP,
    ),
    RAILS_N_SAILS_SERVER_PORT: port("Rails 'n Sails server port").default(
      26980,
    ),
    PLAYER_LIMIT: z.coerce
      .number()
      .int()
      .min(0)
      .max(1000, "Player limit must be between 0 and 1000")
      .default(100),

    RAILS_N_SAILS_RCON_PORT: port("Rails 'n Sails RCON port").default(25583),
    RAILS_N_SAILS_RCON_PASSWORD: z
      .string()
      .max(100, "RCON password is too long")
      .optional(),

    VOTIFIER_HOST: z.string().default("0.0.0.0"),
    VOTIFIER_PORT: port("Votifier port").optional(),
    VOTIFIER_TOKEN: z
      .string()
      .min(16, "Votifier token must be at least 16 characters")
      .optional(),

    WEBSITE_URL: z.string().url("Website URL must be a valid URL"),
    ADMIN_PANEL_URL: z.string().url("Admin panel URL must be a valid URL"),
    MAP_URL: z.string().url("Map URL must be a valid URL"),
    DEV_CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),

    PUPPETEER_SECRET: z
      .string()
      .min(32, "Puppeteer secret must be at least 32 characters")
      .optional(),
    PUPPETEER_EXECUTABLE_PATH: z.string().min(1).optional(),
    PUPPETEER_BASE_URL: z.string().url().optional(),

    SKIN_API_URL: z.string().url("Skin API URL must be a valid URL").optional(),

    PLAYTIME_SYNC_TARGET_URL: z.string().url().optional(),
    PLAYTIME_SYNC_SECRET: z
      .string()
      .min(32, "Playtime sync secret must be at least 32 characters")
      .optional(),

    CLAUDE_API_URL: z.string().url().optional(),
    ADMIN_CHAT_SECRET: z
      .string()
      .min(32, "Admin chat secret must be at least 32 characters")
      .optional(),

    REDIS_URL: z
      .string()
      .regex(
        /^rediss?:\/\/.+/,
        "Redis URL must start with redis:// or rediss://",
      )
      .optional(),

    CONTENT_GATEWAY_URL: z.string().url().optional(),
    CONTENT_GATEWAY_TOKEN: z.string().min(32).optional(),

    CURSEFORGE_MODPACK_PROJECT_ID: z.coerce
      .number()
      .int()
      .positive()
      .default(1660984),

    SANDBOX_SERVICE_TOKEN: z.string().min(32).optional(),

    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),

    MC_SERVER_LOCAL_PATH: z.string().min(1).optional(),

    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_PUBLIC_URL: z
      .string()
      .url("R2 public URL must be a valid URL")
      .optional(),

    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z
      .string()
      .email("Must be valid email address")
      .default("admin@createrington.com"),

    STORAGE_PATH: z.string().min(1).default("./storage"),
  })
  .superRefine((data, ctx) => {
    if (data.MOD_JWT_SECRET === data.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MOD_JWT_SECRET"],
        message:
          "MOD_JWT_SECRET must differ from JWT_ACCESS_SECRET (sharing defeats the mod/web trust-boundary split)",
      });
    }

    if (
      data.LAUNCHER_JWT_SECRET &&
      (data.LAUNCHER_JWT_SECRET === data.JWT_ACCESS_SECRET ||
        data.LAUNCHER_JWT_SECRET === data.MOD_JWT_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LAUNCHER_JWT_SECRET"],
        message:
          "LAUNCHER_JWT_SECRET must differ from JWT_ACCESS_SECRET and MOD_JWT_SECRET",
      });
    }

    if (data.NODE_ENV !== "production") return;
    if (isDevHostname(data.WEBSITE_URL)) return;

    const required: Array<[keyof typeof data, string]> = [
      ["RAILS_N_SAILS_SFTP_HOST", "Rails 'n Sails SFTP host required"],
      ["RAILS_N_SAILS_SFTP_PORT", "Rails 'n Sails SFTP port required"],
      ["RAILS_N_SAILS_SFTP_USER", "Rails 'n Sails SFTP user required"],
      ["RAILS_N_SAILS_SFTP_PASS", "Rails 'n Sails SFTP password required"],
      [
        "RAILS_N_SAILS_SFTP_STATS_PATH",
        "Rails 'n Sails SFTP stats path required",
      ],
      ["RAILS_N_SAILS_RCON_PASSWORD", "RCON password is required"],
      ["PUPPETEER_SECRET", "Puppeteer secret is required"],
      ["RESEND_API_KEY", "Resend API key is required"],
    ];

    for (const [key, message] of required) {
      const value = data[key];
      if (value === undefined || value === null || value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message,
        });
      }
    }

    if (data.RAILS_N_SAILS_SERVER_IP === DEV_FALLBACK_SERVER_IP) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RAILS_N_SAILS_SERVER_IP"],
        message: `Rails 'n Sails server IP is required (${DEV_FALLBACK_SERVER_IP} is the dev fallback)`,
      });
    }

    if (isDevHostname(data.DISCORD_OAUTH_REDIRECT_URI)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DISCORD_OAUTH_REDIRECT_URI"],
        message: "OAuth redirect URI still points at a dev/local host",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const isValidateOnly = process.argv.includes("--validate-only");

function parseForGeneration(): Env {
  const parsed: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(envSchema.shape)) {
    const result = schema.safeParse(process.env[key]);
    parsed[key] = result.success
      ? result.data
      : schema.safeParse(undefined).data;
  }
  return parsed as Env;
}

function validateEnv(): Env {
  if (process.env.VALIDATION_MODE === "generation") {
    return parseForGeneration();
  }

  try {
    const validated = envSchema.parse(process.env);
    console.info("All required environment variables are set and valid");

    if (isValidateOnly) {
      console.info("Validation complete. Exiting");
      process.exit(0);
    }
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment validation failed:");
      error.issues.forEach((issue) => {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      });
    } else {
      console.error("Unexpected error during environment validation", error);
    }
    process.exit(1);
  }
}

export const env = validateEnv();

export interface envModeConfig {
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly isTest: boolean;
  readonly isDevDeployment: boolean;
  readonly isProductionDeployment: boolean;
}

function checkIsDevDeployment(): boolean {
  return isDevHostname(env.WEBSITE_URL);
}

export const envMode: envModeConfig = {
  isDev: env.NODE_ENV === "development",
  isProd: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  isDevDeployment: checkIsDevDeployment(),
  isProductionDeployment:
    env.NODE_ENV === "production" && !checkIsDevDeployment(),
} as const;
