import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_PATH = path.resolve(__dirname, "..", "..", "..", "..", "..");

dotenv.config({ path: path.join(ENV_PATH, ".env"), quiet: true });

/**
 * Zod schema defining structure and validation rules for environment variables
 * // Server
 * @property {number} PORT - Server port number (must be a positive integer, default 5000)
 * @property {string} NODE_ENV - Application environment (development, production, test)
 * // Database
 * @property {string} DB_USER - The PostgreSQL username
 * @property {string} DB_HOST - The PostgreSQL host
 * @property {string} DB_DATABASE - The name of the database
 * @property {string} DB_PASSWORD - The database user's password
 * @property {string} DB_PORT - The port PostgreSQL is running on
 * // Discord
 * @property {string} DISCORD_GUILD_ID - Discord server/guild ID
 * @property {string} DISCORD_MAIN_BOT_TOKEN - Discord bot authentication token
 * @property {string} DISCORD_MAIN_BOT_ID - Discord bot application/client ID
 * @property {string} DISCORD_MAIN_BOT_WEBHOOK_ID - Discord bot webhook application/client ID
 * @property {string} DISCORD_WEB_BOT_TOKEN - Discord bot authentication token
 * @property {string} DISCORD_WEB_BOT_ID - Discord bot application/client ID
 * @property {string} DISCORD_OAUTH_CLIENT_ID - Discord auth app ID
 * @property {string} DISCORD_OAUTH_CLIENT_SECRET - Application secret used for OAuth
 * @property {string} DISCORD_OAUTH_REDIRECT_URI_DEV - Development mode redirect uri
 * @property {string} DISCORD_OAUTH_REDIRECT_URI_PROD - Production mode redirect uri
 * // Minecraft Servers
 * @property {string} COGS_AND_STEAM_SERVER_IP_ADDRESS - Cogs and Steam server IP address
 * @property {number} COGS_AND_STEAM_SERVER_PORT - Cogs and Steam server port
 * @property {string} TEST_SERVER_IP_ADDRESS - Test server IP address
 * @property {number} TEST_SERVER_PORT - Test server port
 * @property {string} LOCAL_SERVER_IP_ADDRESS - Dev env IP address
 * @property {number} PLAYER_LIMIT - Player limit shared on all servers
 * // RCON (Minecraft server)
 * @property {number} COGS_AND_STEAM_RCON_PORT - RCON server port
 * @property {string} COGS_AND_STEAM_RCON_PASSWORD - RCON authentication password
 * @property {number} TEST_SERVER_RCON_PORT - RCON server port
 * @property {string} TEST_SERVER_RCON_PASSWORD - RCON authentication
 * // Auth
 * @property {string} JWT_SECRET - Secret for cookies
 * @property {string} JWT_EXPIRES_IN - Expiry for json tokens
 * // Email
 * @property {string} EMAIL_HOST - SMTP host server (e.g., smtp.gmail.com)
 * @property {number} EMAIL_PORT - SMTP port (587 for TLS, 465 for SSL, 25 for non-secure)
 * @property {boolean} EMAIL_SECURE - Whether to use TLS/SSL (true for port 465, false for 587)
 * @property {string} EMAIL_ADDRESS - Email address to send from
 * @property {string} EMAIL_PASS - Password/app password for the email account
 */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // Server
  DB_USER: z.string().min(1, "Database user is required"),
  DB_HOST: z.string().min(1, "Database host is required"),
  DB_DATABASE: z.string().min(1, "Database name is required"),
  DB_PASSWORD: z.string().min(1, "Database password is required"),
  DB_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5432)
    .refine((port) => port >= 1 && port <= 65535, {
      message: "Database port must be between 1 and 65535",
    }),

  // Discord
  DISCORD_GUILD_ID: z
    .string()
    .min(1, "Guild ID is required")
    .regex(/^\d+$/, "Guild ID must be numeric"),
  DISCORD_MAIN_BOT_TOKEN: z
    .string()
    .min(1, "Bot token is required")
    .regex(/^[\w\-\.]+$/, "Bot token must be a valid Discord token format"),
  DISCORD_MAIN_BOT_ID: z
    .string()
    .min(1, "Bot ID is required")
    .regex(/^\d+$/, "Bot ID must be numeric"),
  DISCORD_MAIN_BOT_WEBHOOK_ID: z
    .string()
    .min(1, "Bot ID is required")
    .regex(/^\d+$/, "Bot ID must be numeric"),
  DISCORD_WEB_BOT_TOKEN: z
    .string()
    .min(1, "Bot token is required")
    .regex(/^[\w\-\.]+$/, "Bot token must be a valid Discord token format"),
  DISCORD_WEB_BOT_ID: z
    .string()
    .min(1, "Bot ID is required")
    .regex(/^\d+$/, "Bot ID must be numeric"),
  DISCORD_OAUTH_CLIENT_ID: z
    .string()
    .min(1, "OAuth client ID is required")
    .regex(/^\d+$/, "OAuth client ID must be numeric"),
  DISCORD_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1, "OAuth client secret is required")
    .min(32, "OAuth client secret must be at least 32 characters"),
  DISCORD_OAUTH_REDIRECT_URI_DEV: z
    .string()
    .url("Development redirect URI must be a valid URL")
    .min(1, "Development redirect URI is required"),
  DISCORD_OAUTH_REDIRECT_URI_PROD: z
    .string()
    .url("Production redirect URI must be a valid URL")
    .min(1, "Production redirect URI is required"),

  // Auth
  JWT_SECRET: z.string().min(1, "JWT secret is required"),
  JWT_EXPIRES_IN: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      "JWT_EXPIRES_IN must be in format: number + unit (s/m/h/d). Examples: 60s, 15m, 24h, 7d",
    )
    .default("7d"),

  // Minecraft Servers
  COGS_AND_STEAM_SERVER_IP: z
    .string()
    .min(1, "Cogs and Steam server IP is required")
    .refine(
      (ip) => {
        // IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(ip)) return false;

        // Validate each octet is 0-255
        const octets = ip.split(".");
        return octets.every((octet) => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
      },
      { message: "Cogs and Steam server IP must be a valid IPv4 address" },
    ),
  COGS_AND_STEAM_SERVER_PORT: z.coerce
    .number()
    .int()
    .positive()
    .refine((port) => port >= 1 && port <= 65535, {
      message: "Cogs and Steam server port must be between 1 and 65535",
    }),
  TEST_SERVER_IP: z
    .string()
    .min(1, "Cogs and Steam server IP is required")
    .refine(
      (ip) => {
        // IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(ip)) return false;

        // Validate each octet is 0-255
        const octets = ip.split(".");
        return octets.every((octet) => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
      },
      { message: "Cogs and Steam server IP must be a valid IPv4 address" },
    ),
  TEST_SERVER_PORT: z.coerce
    .number()
    .int()
    .positive()
    .refine((port) => port >= 1 && port <= 65535, {
      message: "Cogs and Steam server port must be between 1 and 65535",
    }),
  LOCAL_SERVER_IP_ADDRESS: z
    .string()
    .min(1, "Dev IP address is required")
    .refine(
      (ip) => {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(ip)) return false;

        const octets = ip.split(".");
        return octets.every((octet) => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
      },
      { message: "Dev server IP must be a valid IPv4 address" },
    ),
  PLAYER_LIMIT: z.coerce
    .number()
    .int()
    .refine((limit) => limit >= 0 && limit <= 1000, {
      message: "Player limit must be between 0 and 1000",
    }),

  // RCON (Minecraft server)
  COGS_AND_STEAM_RCON_PORT: z.coerce
    .number()
    .int()
    .positive()
    .refine((port) => port >= 1 && port <= 65535, {
      message: "RCON port must be between 1 and 65535",
    }),
  COGS_AND_STEAM_RCON_PASSWORD: z
    .string()
    .min(1, "RCON password is required")
    .max(100, "RCON password is too long"),
  TEST_RCON_PORT: z.coerce
    .number()
    .int()
    .positive()
    .refine((port) => port >= 1 && port <= 65535, {
      message: "RCON port must be between 1 and 65535",
    }),
  TEST_RCON_PASSWORD: z
    .string()
    .min(1, "RCON password is required")
    .max(100, "RCON password is too long"),

  // Email: TODO
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
  EMAIL_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(587)
    .refine((port) => port >= 1 && port <= 65535, {
      message: "Email port must be between 1 and 65535",
    })
    .refine((port) => [25, 465, 587, 2525].includes(port), {
      message:
        "Email port should be typically 25, 465 (SSL), 587 (TLS), or 2525",
    })
    .or(
      z.coerce
        .number()
        .int()
        .positive()
        .refine((port) => port >= 1 && port <= 65535),
    ),
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
 * This function parses process.env and ensures all required environment variables
 * are present and vallid according to the schema. If validation fails, it logs
 * detailed error messages and exists the process
 *
 * @returns Validated and type-safe environment configuration object
 * @throws Exits process with code 1 if validation fails
 */
function validateEnv(): Env {
  console.log("Validating environment...");

  if (process.env.VALIDATION_MODE === "generation") {
    console.log("Generation mode: Skipping full validation (DB vars only)");
    return process.env as any as Env;
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
} as const;
