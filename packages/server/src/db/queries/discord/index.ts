import type { Pool, PoolClient } from "pg";
import { DiscordAutoQueries } from "@/db/queries/discord/auto";
import { DiscordEmbedQueries } from "@/db/queries/discord/embed";
import { DiscordGuildQueries } from "@/db/queries/discord/guild";

/**
 * Namespace queries for discord
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'discord_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all DiscordQueries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class DiscordQueries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "discord.actions")
   */
  private static queryInstances = new WeakMap<
    Pool | PoolClient,
    Map<string, unknown>
  >();

  /**
   * Get or create a child query instance from the singleton cache
   * 
   * Implements the singleton pattern by checking the cache first and
   * creating new instances only when needed. All instances for a given
   * connection are stored in the same cache.
   * 
   * @param key - Cache key for this child (e.g., "actions", "settings")
   * @param QueryClass - Constructor for the child query class
   * @returns Cached or newly created child query instance
   * 
   * @remarks
   * - Cache key is prefixed with namespace (e.g., "discord.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!DiscordQueries.queryInstances.has(this.db)) {
      DiscordQueries.queryInstances.set(this.db, new Map());
    }

    const cache = DiscordQueries.queryInstances.get(this.db)!;
    const fullKey = `discord.${key}`;

    // Create and cache child instance if not exists
    if (!cache.has(fullKey)) {
      cache.set(fullKey, new QueryClass(this.db));
    }

    return cache.get(fullKey) as T;
  }

  /**
   * @param db - Database pool or client to use for all child queries
   */
  constructor(protected db: Pool | PoolClient) {}

  /** Private backing field for lazy-loaded discord_auto queries */
  private _auto?: DiscordAutoQueries;

  /**
   * Lazy-loaded singleton accessor for discord_auto
   * 
   * Returns a DiscordAutoQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton DiscordAutoQueries instance
   */
  get auto(): DiscordAutoQueries {
    if (!this._auto) {
      this._auto = this.getOrCreateChild<DiscordAutoQueries>('auto', DiscordAutoQueries);
    }
    return this._auto;
  }

  /** Private backing field for lazy-loaded discord_embed queries */
  private _embed?: DiscordEmbedQueries;

  /**
   * Lazy-loaded singleton accessor for discord_embed
   * 
   * Returns a DiscordEmbedQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton DiscordEmbedQueries instance
   */
  get embed(): DiscordEmbedQueries {
    if (!this._embed) {
      this._embed = this.getOrCreateChild<DiscordEmbedQueries>('embed', DiscordEmbedQueries);
    }
    return this._embed;
  }

  /** Private backing field for lazy-loaded discord_guild queries */
  private _guild?: DiscordGuildQueries;

  /**
   * Lazy-loaded singleton accessor for discord_guild
   * 
   * Returns a DiscordGuildQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton DiscordGuildQueries instance
   */
  get guild(): DiscordGuildQueries {
    if (!this._guild) {
      this._guild = this.getOrCreateChild<DiscordGuildQueries>('guild', DiscordGuildQueries);
    }
    return this._guild;
  }
}
