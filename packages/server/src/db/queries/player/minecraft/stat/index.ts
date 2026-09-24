import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatKeyQueries } from "@/db/queries/player/minecraft/stat/key";
import { PlayerMinecraftStatTotalQueries } from "@/db/queries/player/minecraft/stat/total";

/**
 * Namespace queries for player_minecraft_stat
 *
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'player_minecraft_stat_' prefix.
 *
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all PlayerMinecraftStatQueries instances using same connection
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class PlayerMinecraftStatQueries {
  /**
   * Static singleton registry for child query instances
   *
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "player_minecraft_stat.actions")
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
   * - Cache key is prefixed with namespace (e.g., "player_minecraft_stat.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    // Initialize cache for this connection if not exists
    if (!PlayerMinecraftStatQueries.queryInstances.has(this.db)) {
      PlayerMinecraftStatQueries.queryInstances.set(this.db, new Map());
    }

    const cache = PlayerMinecraftStatQueries.queryInstances.get(this.db)!;
    const fullKey = `player_minecraft_stat.${key}`;

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

  /** Private backing field for lazy-loaded player_minecraft_stat_key queries */
  private _key?: PlayerMinecraftStatKeyQueries;

  /**
   * Lazy-loaded singleton accessor for player_minecraft_stat_key
   *
   * Returns a PlayerMinecraftStatKeyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton PlayerMinecraftStatKeyQueries instance
   */
  get key(): PlayerMinecraftStatKeyQueries {
    if (!this._key) {
      this._key = this.getOrCreateChild<PlayerMinecraftStatKeyQueries>(
        "key",
        PlayerMinecraftStatKeyQueries,
      );
    }
    return this._key;
  }

  /** Private backing field for lazy-loaded player_minecraft_stat_total queries */
  private _total?: PlayerMinecraftStatTotalQueries;

  /**
   * Lazy-loaded singleton accessor for player_minecraft_stat_total
   *
   * Returns a PlayerMinecraftStatTotalQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton PlayerMinecraftStatTotalQueries instance
   */
  get total(): PlayerMinecraftStatTotalQueries {
    if (!this._total) {
      this._total = this.getOrCreateChild<PlayerMinecraftStatTotalQueries>(
        "total",
        PlayerMinecraftStatTotalQueries,
      );
    }
    return this._total;
  }
}
