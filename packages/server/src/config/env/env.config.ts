import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_PATH = path.resolve(__dirname, "..", "..", "..", "..", "..");

dotenv.config({ path: path.join(ENV_PATH, ".env"), quiet: true });

// Reusable validators
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

const envSchema = z.object({
  // Server
  PORT: port("Server port").default(5001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DB_USER: z.string().min(1, "Database user is required"),
  DB_HOST: z.string().min(1, "Database host is required"),
  DB_DATABASE: z.string().min(1, "Database name is required"),
  DB_PASSWORD: z.string().min(1, "Database password is required"),
  DB_PORT: port("Database port").default(5432),

  // SFTP
  // Cogs & Steam
  COGS_AND_STEAM_SFTP_HOST: z
    .string()
    .min(1, "Cogs and Steam SFTP host required"),
  COGS_AND_STEAM_SFTP_PORT: port("Cogs and Steam SFTP port"),
  COGS_AND_STEAM_SFTP_USER: z
    .string()
    .min(1, "Cogs and Steam SFTP user required"),
  COGS_AND_STEAM_SFTP_PASS: z
    .string()
    .min(1, "Cogs and Steam SFTP password required"),
  COGS_AND_STEAM_SFTP_STATS_PATH: z
    .string()
    .min(1, "Cogs and Steam SFTP stats path required"),

  // Discord
  DISCORD_GUILD_ID: discordId("Guild ID"),
  DISCORD_MAIN_BOT_TOKEN: discordToken("Main bot token"),
  DISCORD_MAIN_BOT_ID: discordId("Main bot ID"),
  DISCORD_MAIN_BOT_WEBHOOK_ID: discordId("Main bot webhook ID"),
  DISCORD_WEB_BOT_TOKEN: discordToken("Web bot token"),
  DISCORD_WEB_BOT_ID: discordId("Web bot ID"),
  DISCORD_OAUTH_CLIENT_ID: discordId("OAuth client ID"),
  DISCORD_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1, "OAuth client secret is required")
    .min(32, "OAuth client secret must be at least 32 characters"),
  DISCORD_OAUTH_REDIRECT_URI_DEV: z
    .string()
    .url("Development redirect URI must be a valid URL"),
  DISCORD_OAUTH_REDIRECT_URI_PROD: z
    .string()
    .url("Production redirect URI must be a valid URL"),

  // Auth
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT access secret must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      "JWT_ACCESS_EXPIRES_IN must be in format: number + unit (s/m/h/d). Examples: 60s, 15m, 24h, 7d",
    )
    .default("15m"),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).default(30),
  REFRESH_COOKIE_NAME: z.string().default("crt_refresh"),

  // Minecraft Servers
  COGS_AND_STEAM_SERVER_IP: ipv4("Cogs and Steam server IP"),
  COGS_AND_STEAM_SERVER_PORT: port("Cogs and Steam server port"),
  LOCAL_SERVER_IP_ADDRESS: ipv4("Local server IP"),
  PLAYER_LIMIT: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000, "Player limit must be between 0 and 1000"),

  // RCON
  COGS_AND_STEAM_RCON_PORT: port("Cogs and Steam RCON port"),
  COGS_AND_STEAM_RCON_PASSWORD: z
    .string()
    .min(1, "RCON password is required")
    .max(100, "RCON password is too long"),
  // URLs
  WEBSITE_URL: z.string().url("Website URL must be a valid URL"),
  ADMIN_PANEL_URL: z.string().url("Admin panel URL must be a valid URL"),
  ASSETS_URL: z.string().url("Assets URL must be a valid URL"),
  MAP_URL: z.string().url("Map URL must be a valid URL"),

  // Puppeteer (internal rendering)
  PUPPETEER_SECRET: z
    .string()
    .min(32, "Puppeteer secret must be at least 32 characters"),
  PUPPETEER_EXECUTABLE_PATH: z.string().min(1).optional(),
  PUPPETEER_BASE_URL: z.string().url().optional(),

  // Playtime sync (cross-environment forwarding)
  PLAYTIME_SYNC_TARGET_URL: z.string().url().optional(),
  PLAYTIME_SYNC_SECRET: z
    .string()
    .min(32, "Playtime sync secret must be at least 32 characters")
    .optional(),

  // Claude automation proxy — admin chat widget talks to claude-automation
  // through the app backend so the shared secret never ships to clients.
  CLAUDE_API_URL: z.string().url().optional(),
  ADMIN_CHAT_SECRET: z.string().min(1).optional(),

  // CurseForge
  CURSEFORGE_API_KEY: z.string().min(1).optional(),

  // AI (OpenAI) — optional; AI features are disabled when the key is not set
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),

  // MC Server local path
  // Optional local path for direct filesystem access (bypasses SFTP).
  // Set to the Minecraft server data directory (e.g. /opt/infrastructure/mc-test/data).
  // Used by maintenance service and structure pack rotation.
  // When absent, these services fall back to SFTP (production-only).
  MC_SERVER_LOCAL_PATH: z.string().min(1).optional(),

  // Stripe (optional — donation features are disabled when not configured)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Email
  EMAIL_HOST: z
    .string()
    .min(1, "Email host is required")
    .refine(
      (host) => {
        if (host === "localhost" || host === "127.0.0.1") return true;
        return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
          host,
        );
      },
      { message: "Email host must be a valid hostname or IP address" },
    ),
  EMAIL_PORT: port("Email port").default(587),
  EMAIL_SECURE: z.coerce.boolean().default(false),
  EMAIL_ADDRESS: z
    .string()
    .email("Must be valid email address")
    .min(1, "Email address is required"),
  EMAIL_PASS: z
    .string()
    .min(1, "Email password is required")
    .min(8, "Email password should be at least 8 characters for security"),
});

/**
 * Type representing validated environment configuration
 * Automatically inferred from the envSchema
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Flag for running only validation of env variables
 * Exits the process on success
 */
const isValidateOnly = process.argv.includes("--validate-only");

/**
 * Validates environment variables against the defined schema
 *
 * Parses process.env and ensures all required environment variables are present
 * and valid according to the schema. If validation fails, it logs detailed error
 * messages and exits the process.
 *
 * @returns Validated and type-safe environment configuration object
 * @throws Exits process with code 1 if validation fails
 */
function validateEnv(): Env {
  console.log("Validating environment...");

  if (process.env.VALIDATION_MODE === "generation") {
    console.log("Generation mode: Skipping full validation (DB vars only)");
    return process.env as unknown as Env;
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

/**
 * Pre-validated environment configuration object
 *
 * This object is created at module load time and provides type-safe access
 * to validated environment variables throughout the application
 */
export const env = validateEnv();

export interface envModeConfig {
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly isTest: boolean;
  readonly isDevDeployment: boolean;
}

function checkIsDevDeployment(): boolean {
  try {
    const url = new URL(env.WEBSITE_URL);
    const host = url.hostname;
    return (
      host === "127.0.0.1" || host === "localhost" || host.startsWith("dev.")
    );
  } catch {
    return false;
  }
}

export const envMode: envModeConfig = {
  /**
   * True when NODE_ENV is 'development'
   * Used to enable development-specific features and logging
   */
  isDev: env.NODE_ENV === "development",
  /**
   * True when NODE_ENV is 'production'
   * Used to enable production optimizations and disable debug features
   */
  isProd: env.NODE_ENV === "production",
  /**
   * True when NODE_ENV = 'test'
   * Used to enable test-specific configuration and mocking
   */
  isTest: env.NODE_ENV === "test",
  /**
   * True when WEBSITE_URL points to a dev/local environment
   * (localhost, 127.0.0.1, or dev.* subdomain).
   * Used to disable production-only features like AI generation and SFTP.
   */
  isDevDeployment: checkIsDevDeployment(),
} as const;
