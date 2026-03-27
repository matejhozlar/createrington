import type { Pool, PoolClient } from "pg";
import { PlayerInactivityWarningQueries } from "@/db/queries/player/inactivity/warning";

/**
 * Namespace queries for player_inactivity
 *
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'player_inactivity_' prefix.
 *
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all PlayerInactivityQueries instances using same connection
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class PlayerInactivityQueries {
  /**
   * Static singleton registry for child query instances
   *
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "player_inactivity.actions")
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
   * - Cache key is prefixed with namespace (e.g., "player_inactivity.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    // Initialize cache for this connection if not exists
    if (!PlayerInactivityQueries.queryInstances.has(this.db)) {
      PlayerInactivityQueries.queryInstances.set(this.db, new Map());
    }

    const cache = PlayerInactivityQueries.queryInstances.get(this.db)!;
    const fullKey = `player_inactivity.${key}`;

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

  /** Private backing field for lazy-loaded player_inactivity_warning queries */
  private _warning?: PlayerInactivityWarningQueries;

  /**
   * Lazy-loaded singleton accessor for player_inactivity_warning
   *
   * Returns a PlayerInactivityWarningQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton PlayerInactivityWarningQueries instance
   */
  get warning(): PlayerInactivityWarningQueries {
    if (!this._warning) {
      this._warning = this.getOrCreateChild<PlayerInactivityWarningQueries>(
        "warning",
        PlayerInactivityWarningQueries,
      );
    }
    return this._warning;
  }
}
