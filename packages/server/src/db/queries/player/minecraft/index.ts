import type { Pool, PoolClient } from "pg";
import { PlayerMinecraftStatsQueries } from "@/db/queries/player/minecraft/stats";

/**
 * Namespace queries for player_minecraft
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'player_minecraft_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all PlayerMinecraftQueries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class PlayerMinecraftQueries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "player_minecraft.actions")
   */
  private static queryInstances = new WeakMap<
    Pool | PoolClient,
    Map<string, any>
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
   * - Cache key is prefixed with namespace (e.g., "player_minecraft.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!PlayerMinecraftQueries.queryInstances.has(this.db)) {
      PlayerMinecraftQueries.queryInstances.set(this.db, new Map());
    }

    const cache = PlayerMinecraftQueries.queryInstances.get(this.db)!;
    const fullKey = `player_minecraft.${key}`;

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

  /** Private backing field for lazy-loaded player_minecraft_stats queries */
  private _stats?: PlayerMinecraftStatsQueries;

  /**
   * Lazy-loaded singleton accessor for player_minecraft_stats
   * 
   * Returns a PlayerMinecraftStatsQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton PlayerMinecraftStatsQueries instance
   */
  get stats(): PlayerMinecraftStatsQueries {
    if (!this._stats) {
      this._stats = this.getOrCreateChild<PlayerMinecraftStatsQueries>('stats', PlayerMinecraftStatsQueries);
    }
    return this._stats;
  }
}
