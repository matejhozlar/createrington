import type { Pool, PoolClient } from "pg";
import { ServerAllyFakePartyQueries } from "@/db/queries/server/ally/fake/party";

/**
 * Namespace queries for server_ally_fake
 *
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'server_ally_fake_' prefix.
 *
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all ServerAllyFakeQueries instances using same connection
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class ServerAllyFakeQueries {
  /**
   * Static singleton registry for child query instances
   *
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "server_ally_fake.actions")
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
   * - Cache key is prefixed with namespace (e.g., "server_ally_fake.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    // Initialize cache for this connection if not exists
    if (!ServerAllyFakeQueries.queryInstances.has(this.db)) {
      ServerAllyFakeQueries.queryInstances.set(this.db, new Map());
    }

    const cache = ServerAllyFakeQueries.queryInstances.get(this.db)!;
    const fullKey = `server_ally_fake.${key}`;

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

  /** Private backing field for lazy-loaded server_ally_fake_party queries */
  private _party?: ServerAllyFakePartyQueries;

  /**
   * Lazy-loaded singleton accessor for server_ally_fake_party
   *
   * Returns a ServerAllyFakePartyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerAllyFakePartyQueries instance
   */
  get party(): ServerAllyFakePartyQueries {
    if (!this._party) {
      this._party = this.getOrCreateChild<ServerAllyFakePartyQueries>(
        "party",
        ServerAllyFakePartyQueries,
      );
    }
    return this._party;
  }
}
