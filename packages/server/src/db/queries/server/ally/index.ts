import type { Pool, PoolClient } from "pg";
import { ServerAllyFakeQueries } from "@/db/queries/server/ally/fake";
import { ServerAllyPartyQueries } from "@/db/queries/server/ally/party";
import { ServerAllyQualifiedQueries } from "@/db/queries/server/ally/qualified";

/**
 * Namespace queries for server_ally
 *
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'server_ally_' prefix.
 *
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all ServerAllyQueries instances using same connection
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class ServerAllyQueries {
  /**
   * Static singleton registry for child query instances
   *
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "server_ally.actions")
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
   * - Cache key is prefixed with namespace (e.g., "server_ally.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    // Initialize cache for this connection if not exists
    if (!ServerAllyQueries.queryInstances.has(this.db)) {
      ServerAllyQueries.queryInstances.set(this.db, new Map());
    }

    const cache = ServerAllyQueries.queryInstances.get(this.db)!;
    const fullKey = `server_ally.${key}`;

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

  /** Private backing field for lazy-loaded server_ally_fake queries */
  private _fake?: ServerAllyFakeQueries;

  /**
   * Lazy-loaded singleton accessor for server_ally_fake
   *
   * Returns a ServerAllyFakeQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerAllyFakeQueries instance
   */
  get fake(): ServerAllyFakeQueries {
    if (!this._fake) {
      this._fake = this.getOrCreateChild<ServerAllyFakeQueries>(
        "fake",
        ServerAllyFakeQueries,
      );
    }
    return this._fake;
  }

  /** Private backing field for lazy-loaded server_ally_party queries */
  private _party?: ServerAllyPartyQueries;

  /**
   * Lazy-loaded singleton accessor for server_ally_party
   *
   * Returns a ServerAllyPartyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerAllyPartyQueries instance
   */
  get party(): ServerAllyPartyQueries {
    if (!this._party) {
      this._party = this.getOrCreateChild<ServerAllyPartyQueries>(
        "party",
        ServerAllyPartyQueries,
      );
    }
    return this._party;
  }

  /** Private backing field for lazy-loaded server_ally_qualified queries */
  private _qualified?: ServerAllyQualifiedQueries;

  /**
   * Lazy-loaded singleton accessor for server_ally_qualified
   *
   * Returns a ServerAllyQualifiedQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerAllyQualifiedQueries instance
   */
  get qualified(): ServerAllyQualifiedQueries {
    if (!this._qualified) {
      this._qualified = this.getOrCreateChild<ServerAllyQualifiedQueries>(
        "qualified",
        ServerAllyQualifiedQueries,
      );
    }
    return this._qualified;
  }
}
