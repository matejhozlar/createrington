import type { ColorResolvable } from "discord.js";
import type { envModeConfig } from "./env/env.config";
import type {
  MemberRolesConfig,
  ChannelConfig,
  CategoriesConfig,
} from "./discord.types";

// ============================================================================
// Main Configuration Interface
// ============================================================================

export interface Config {
  envMode: envModeConfig;
  meta: MetaConfig;
  app: AppConfig;
  utils: UtilsConfig;
  database: DatabaseConfig;
  discord: DiscordConfig;
  servers: ServersConfig;
  email: EmailConfig;
  economy: EconomyConfig;
}

// ============================================================================
// Application Configuration
// ============================================================================

interface AppConfig {
  port: number;
  auth: {
    jwt: JWTConfig;
    allowedServerIps: {
      local: string;
    };
  };
}

interface JWTConfig {
  readonly secret: string;
  readonly expiresIn: string;
}

// ============================================================================
// Meta Configuration
// ============================================================================

interface MetaConfig {
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
    readonly discord: string;
  };
  readonly links: {
    readonly discordInvite: string;
    readonly website: string;
    readonly adminPanel: string;
    readonly modpack: string;
    readonly map: string;
  };
}

// ============================================================================
// Utilities Configuration
// ============================================================================

interface UtilsConfig {
  logger: {
    logDir: string;
    keepDays: number;
  };
}

// ============================================================================
// Database Configuration
// ============================================================================

interface DatabaseConfig {
  pool: PoolConfig;
}

interface PoolConfig {
  // Connection Details
  /** The PostgreSQL username */
  readonly user: string;
  /** The PostgreSQL host */
  readonly host: string;
  /** The name of the database */
  readonly database: string;
  /** The database user's password */
  readonly password: string;
  /** The port PostgreSQL is running on */
  readonly port: number;

  // Pool Size
  /** Maximum number of clients the pool should contain (default: 10) */
  readonly max?: number;
  /** Minimum number of clients to keep in the pool at all times (default: 0) */
  readonly min?: number;

  // Timeouts
  /** How long a client can remain idle before being closed (default: 10,000ms) */
  readonly idleTimeoutMillis?: number;
  /** How long to wait when establishing a new connection (default: 0 - no timeout) */
  readonly connectionTimeoutMillis?: number;
  /** Maximum time a query can run before being cancelled (default: 0 - no timeout) */
  readonly statement_timeout?: number;
  /** Maximum time to wait for a connection from the pool (default: 0 - no timeout) */
  readonly query_timeout?: number;

  // Connection Lifecycle
  /** Maximum age (in milliseconds) that a pooled connection can be reused (default: 0 - never expires) */
  readonly maxLifetimeSeconds?: number;
  /** Number of milliseconds to wait before timing out when connecting a new client (default: 0) */
  readonly connection_timeout?: number;

  // SSL/TLS
  /** SSL/TLS configuration for secure database connections */
  readonly ssl?: boolean | { rejectUnauthorized: boolean };

  // Application Identification
  /** Application name that will appear in PostgreSQL's pg_stat_activity view */
  readonly application_name?: string;

  // Advanced Options
  /** Allow exiting the process while the pool has connections checked out (default: true) */
  readonly allowExitOnIdle?: boolean;
  /** Maximum number of times to retry a connection before giving up (default: 0) */
  readonly connectionRetryAttemps?: number;
}

// ============================================================================
// Discord Configuration
// ============================================================================

interface DiscordConfig {
  bots: {
    main: BotConfig;
    web: BotConfig;
  };
  guild: {
    id: string;
    roles: MemberRolesConfig;
    channels: ChannelConfig;
    categories: CategoriesConfig;
  };
  embeds: {
    colors: ColorsConfig;
  };
  events: {
    onGuildMemberAdd: OnGuildMemberAddConfig;
  };
  oauth: OAuthConfig;
}

interface BotConfig {
  /** Discord application/bot ID used for identification */
  readonly id: string;
  /** Discord bot authentication token */
  readonly token: string;
  /** Discord prefix for text commands */
  readonly commandPrefix?: string;
  /** Bot owner IDs */
  readonly owners?: string[];
  /** Discord status message shown in the members list and bot profile */
  readonly statusMessage?: string;
  /** Discord activity type going along-side statusMessage */
  readonly activityType?: "PLAYING" | "WATCHING" | "LISTENING";
  /** Bot webhooks */
  readonly webbhook?: {
    readonly id: string;
  };
}

interface ColorsConfig {
  readonly GREEN: ColorResolvable;
  readonly RED: ColorResolvable;
  readonly BLUE: ColorResolvable;
  readonly GOLD: ColorResolvable;
  readonly PURPLE: ColorResolvable;
  readonly ORANGE: ColorResolvable;
  readonly YELLOW: ColorResolvable;
  readonly CYAN: ColorResolvable;
  readonly PINK: ColorResolvable;
  readonly DARK_BLUE: ColorResolvable;
  readonly DARK_GREEN: ColorResolvable;
  readonly DARK_RED: ColorResolvable;
  readonly DARK_PURPLE: ColorResolvable;
  readonly DARK_GOLD: ColorResolvable;
  readonly GRAY: ColorResolvable;
  readonly DARK_GRAY: ColorResolvable;
  readonly WHITE: ColorResolvable;
  readonly BLACK: ColorResolvable;
}

interface OnGuildMemberAddConfig {
  readonly welcome: {
    /** Channel ID where welcome images are sent */
    readonly channelId: string;
    /** Whether the welcome system is enabled */
    readonly enabled: boolean;
    /** Image styling configuration */
    readonly imageConfig: {
      readonly backgroundColor: string;
      readonly accentColor: string;
      readonly textColor: string;
      readonly secondaryTextColor: string;
      readonly backgroundImageURL: string;
    };
  };
  readonly autoRole: {
    /** Role ID that will be assigned to the player that joined */
    readonly roleId: string;
    /** Whether the auto role system is enabled */
    readonly enabled: boolean;
  };
}

interface OAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

// ============================================================================
// Minecraft Server Configuration
// ============================================================================

interface ServersConfig {
  cogs: MinecraftServerConfig;
  test: MinecraftServerConfig;
  playerLimit: number;
}

interface MinecraftServerConfig {
  readonly ip: string;
  readonly port: number;
  readonly id: number;
  readonly name: string;
  readonly rcon?: {
    readonly host: string;
    readonly password: string;
    readonly port: number;
  };
}

// ============================================================================
// Email Configuration
// ============================================================================

interface EmailConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth: {
    readonly user: string;
    readonly pass: string;
  };
}

// ============================================================================
// Economy Configuration
// ============================================================================

interface EconomyConfig {
  readonly reward: {
    readonly daily: number;
  };
}
