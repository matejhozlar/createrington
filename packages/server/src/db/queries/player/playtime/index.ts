import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeDailyQueries } from "@/db/queries/player/playtime/daily";
import { PlayerPlaytimeHourlyQueries } from "@/db/queries/player/playtime/hourly";
import { PlayerPlaytimeSummaryQueries } from "@/db/queries/player/playtime/summary";

/**
 * Namespace queries for player_playtime
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'player_playtime_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all PlayerPlaytimeQueries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class PlayerPlaytimeQueries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "player_playtime.actions")
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
   * - Cache key is prefixed with namespace (e.g., "player_playtime.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!PlayerPlaytimeQueries.queryInstances.has(this.db)) {
      PlayerPlaytimeQueries.queryInstances.set(this.db, new Map());
    }

    const cache = PlayerPlaytimeQueries.queryInstances.get(this.db)!;
    const fullKey = `player_playtime.${key}`;

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

  /** Private backing field for lazy-loaded player_playtime_daily queries */
  private _daily?: PlayerPlaytimeDailyQueries;

  /**
   * Lazy-loaded singleton accessor for player_playtime_daily
   * 
   * Returns a PlayerPlaytimeDailyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton PlayerPlaytimeDailyQueries instance
   */
  get daily(): PlayerPlaytimeDailyQueries {
    if (!this._daily) {
      this._daily = this.getOrCreateChild<PlayerPlaytimeDailyQueries>('daily', PlayerPlaytimeDailyQueries);
    }
    return this._daily;
  }

  /** Private backing field for lazy-loaded player_playtime_hourly queries */
  private _hourly?: PlayerPlaytimeHourlyQueries;

  /**
   * Lazy-loaded singleton accessor for player_playtime_hourly
   * 
   * Returns a PlayerPlaytimeHourlyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton PlayerPlaytimeHourlyQueries instance
   */
  get hourly(): PlayerPlaytimeHourlyQueries {
    if (!this._hourly) {
      this._hourly = this.getOrCreateChild<PlayerPlaytimeHourlyQueries>('hourly', PlayerPlaytimeHourlyQueries);
    }
    return this._hourly;
  }

  /** Private backing field for lazy-loaded player_playtime_summary queries */
  private _summary?: PlayerPlaytimeSummaryQueries;

  /**
   * Lazy-loaded singleton accessor for player_playtime_summary
   * 
   * Returns a PlayerPlaytimeSummaryQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton PlayerPlaytimeSummaryQueries instance
   */
  get summary(): PlayerPlaytimeSummaryQueries {
    if (!this._summary) {
      this._summary = this.getOrCreateChild<PlayerPlaytimeSummaryQueries>('summary', PlayerPlaytimeSummaryQueries);
    }
    return this._summary;
  }
}
