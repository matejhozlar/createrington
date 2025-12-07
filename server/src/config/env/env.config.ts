import dotenv from "dotenv";
import { readonly, z } from "zod";

dotenv.config({ quiet: true });

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
 * @property {string} DISCORD_GUILD_ID - Discord server/guild ID (must be numeric snowflake)
 * @property {string} DISCORD_BOT_TOKEN - Discord bot authentication token
 * @property {string} DISCORD_BOT_ID - Discord bot application/client ID (must be numeric snowflake)
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
    .regex(
      /^\d{17,19}$/,
      "Guild ID must be a valid Discord snowflake (17-19 digits)"
    ),
  DISCORD_BOT_TOKEN: z
    .string()
    .min(1, "Bot token is required")
    .regex(/^[\w\-\.]+$/, "Bot token must be a valid Discord token format"),
  DISCORD_BOT_ID: z
    .string()
    .min(1, "Bot ID is required")
    .regex(
      /^\d{17,19}$/,
      "Bot ID must be a valid Discord snowflake (17-19 digits)"
    ),
});

/**
 * Type representing validated environment configuration
 * Automatically inferred from the envSchema
 */
export type Env = z.infer<typeof envSchema>;

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
  try {
    const validated = envSchema.parse(process.env);
    console.info("All required environment variables are set and valid");
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
