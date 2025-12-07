import { ColorResolvable } from "discord.js";
import { envModeConfig } from "./env/env.config";

interface UtilsConfig {
  readonly logger: LoggerConfig;
}

interface DatabaseConfig {
  readonly pool: PoolConfig;
}

interface DiscordConfig {
  readonly bots: BotConfig;
  readonly guild: GuildConfig;
  readonly embeds: EmbedConfig;
}

interface EmbedConfig {
  readonly colors: ColorsConfig;
}

export interface Config {
  readonly envMode: envModeConfig;
  readonly app: AppConfig;
  readonly utils: UtilsConfig;
  readonly database: DatabaseConfig;
  readonly discord: DiscordConfig;
}

export interface AppConfig {
  readonly port: number;
}

export interface LoggerConfig {
  /**
   * Root directory where daily log folders/files are written
   * Relative paths are resolved from the process working directory
   */
  logDir: string;
  /**
   * Number of days to retain dated log folders before automatic cleanup
   * Older folders beyond this threshold may be deleted
   */
  keepDays: number;
}

export interface PoolConfig {
  /** The PostgreSQL username */
  readonly user: string;
  /** The PostgreSQL host */
  readonly host: string;
  /** The name of the database */
  readonly database: string;
  /** The database user's password */
  readonly password: string;
  /** Te port PostgreSQL is running on */
  readonly port: number;
  // Connection Pool Size
  /**
   * Maximum number of clients the pool should contain
   *
   * Default: 10
   * Higher values allow for more concurrent queries but more resources
   */
  readonly max?: number;
  /**
   * Minimum number of clients to keep in the pool at all times
   *
   * Default: 0
   * Useful for maintaining ready connections and reducing latency on subsequent queries
   * Settings this > 0 keeps connections warm even during idle periods
   */
  readonly min?: number;
  // Timeout settings
  /**
   * How long a client is allowed to remain idle (not actively using the connection)
   * before being closed by the pool
   *
   * Default: 10,000 ms (10 seconds)
   * Useful for cleaning up unused connections in low-traffic periods
   * Set to 0 to disable idle timeout
   */
  readonly idleTimeoutMillis?: number;
  /**
   * How long to wait when establishing a new connection before timing out
   *
   * Default: 0 (no timeout)
   * Prevents hanging if the database is unreachable or slow to respond
   * Recommended: 10,000-30,000 ms for production environments
   */
  readonly connectionTimeoutMillis?: number;
  /**
   * Maximum time (in ms) that a query can run before being cancelled
   *
   * Default 0 (no timeout)
   * Protects against runaway queries that could lock up connections
   */
  readonly statement_timeout?: number;
  /**
   * Maximum time to wait for a connection from the pool when all connections are in use
   *
   * Default: 0 (no timeout, wait indefinitely)
   * Recommended: Set to prevent requests from hanging forever during high load
   * Example: 5000 (5 seconds) - will throw error if no connection available
   */
  readonly query_timeout?: number;
  // Connection Lifecycle
  /**
   * Maximum age (in milliseconds) that a pooled connection can be reused
   *
   * Default: 0 (connections never expire base on age)
   * Useful for forcing periodic connection refreshes and avoiding stale connections
   * Example: 3600000 (1 hour) to refresh connections regularly
   */
  readonly maxLifetimeSeconds?: number;
  /**
   * Number of milliseconds to wait before timing out when connecting a new client
   *
   * Default: 0 (no timeout)
   * Similar to connectionTimeoutMillis but specifically for the TCP connection phase
   */
  readonly connection_timeout?: number;
  // SSL/TLS Configuration
  /**
   * SSL/TLC configuration for secure database connections
   *
   * Values:
   * - false: Disable SSL (not recommended for production)
   * - true or Object: Enable SSL with optional detailed configuration
   */
  readonly ssl?: boolean | { rejectUnauthorized: boolean };
  // Application Identification
  /**
   * Application name that will appear in PostgreSQL's pg_stat_activity view
   *
   * Useful for monitoring and debugging which application is running queries
   * Example: "my-discord-bot" or "api-server-production"
   */
  readonly application_name?: string;
  // Advanced Options
  /**
   * Allow existing the process while the pool has connections checked out
   *
   * Default: true
   * Set to false if you want to ensure all connections are returned before shutdown
   */
  readonly allowExitOnIdle?: boolean;
  /**
   * Maxmimum number of times to retry a connection before giving up
   *
   * Default: 0 (not retries)
   * Useful for handling transient connection failures
   */
  readonly connectionRetryAttemps?: number;
}

export interface BotConfig {
  main: {
    /**
     * Discord application/bot ID used for identification
     * Required for registering slash commands and API interactions
     */
    id: string;
    /**
     * Discord bot authentication token
     * Used to authenticate and login the bot to Discord's gateway
     */
    token: string;
    /**
     * Discord prefix for text commands
     * Used to make a global config for text commands (e.g.: !test)
     */
    commandPrefix?: string;
    /**
     * Bot owner ids
     */
    owners?: string[];
    /**
     * Discord status message shown in the members list and bot profile
     */
    statusMessage?: string;
    /**
     * Discord activity type going along-side statusMessage
     * Can be standalone
     */
    activityType?: "PLAYING" | "WATCHING" | "LISTENING";
  };
}

export interface GuildConfig {
  /**
   * Discord guild (server) ID where the bot operates
   * Used for guild specific command registration and operations
   */
  id: string;
}

export interface ColorsConfig {
  GREEN: ColorResolvable;
  RED: ColorResolvable;
  BLUE: ColorResolvable;
  GOLD: ColorResolvable;
  PURPLE: ColorResolvable;
  ORANGE: ColorResolvable;
  YELLOW: ColorResolvable;
  CYAN: ColorResolvable;
  PINK: ColorResolvable;
  DARK_BLUE: ColorResolvable;
  DARK_GREEN: ColorResolvable;
  DARK_RED: ColorResolvable;
  DARK_PURPLE: ColorResolvable;
  DARK_GOLD: ColorResolvable;
  GRAY: ColorResolvable;
  DARK_GRAY: ColorResolvable;
  WHITE: ColorResolvable;
  BLACK: ColorResolvable;
}
