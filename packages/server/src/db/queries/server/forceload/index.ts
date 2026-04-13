import type { Pool, PoolClient } from "pg";
import { ServerForceloadChunkQueries } from "@/db/queries/server/forceload/chunk";
import { ServerForceloadMemberQueries } from "@/db/queries/server/forceload/member";
import { ServerForceloadPartyQueries } from "@/db/queries/server/forceload/party";
import { ServerForceloadPlayerQueries } from "@/db/queries/server/forceload/player";

/**
 * Namespace queries for server_forceload
 *
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'server_forceload_' prefix.
 *
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all ServerForceloadQueries instances using same connection
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class ServerForceloadQueries {
  /**
   * Static singleton registry for child query instances
   *
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "server_forceload.actions")
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
   * - Cache key is prefixed with namespace (e.g., "server_forceload.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    // Initialize cache for this connection if not exists
    if (!ServerForceloadQueries.queryInstances.has(this.db)) {
      ServerForceloadQueries.queryInstances.set(this.db, new Map());
    }

    const cache = ServerForceloadQueries.queryInstances.get(this.db)!;
    const fullKey = `server_forceload.${key}`;

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

  /** Private backing field for lazy-loaded server_forceload_chunk queries */
  private _chunk?: ServerForceloadChunkQueries;

  /**
   * Lazy-loaded singleton accessor for server_forceload_chunk
   *
   * Returns a ServerForceloadChunkQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerForceloadChunkQueries instance
   */
  get chunk(): ServerForceloadChunkQueries {
    if (!this._chunk) {
      this._chunk = this.getOrCreateChild<ServerForceloadChunkQueries>(
        "chunk",
        ServerForceloadChunkQueries,
      );
    }
    return this._chunk;
  }

  /** Private backing field for lazy-loaded server_forceload_member queries */
  private _member?: ServerForceloadMemberQueries;

  /**
   * Lazy-loaded singleton accessor for server_forceload_member
   *
   * Returns a ServerForceloadMemberQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerForceloadMemberQueries instance
   */
  get member(): ServerForceloadMemberQueries {
    if (!this._member) {
      this._member = this.getOrCreateChild<ServerForceloadMemberQueries>(
        "member",
        ServerForceloadMemberQueries,
      );
    }
    return this._member;
  }

  /** Private backing field for lazy-loaded server_forceload_party queries */
  private _party?: ServerForceloadPartyQueries;

  /**
   * Lazy-loaded singleton accessor for server_forceload_party
   *
   * Returns a ServerForceloadPartyQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerForceloadPartyQueries instance
   */
  get party(): ServerForceloadPartyQueries {
    if (!this._party) {
      this._party = this.getOrCreateChild<ServerForceloadPartyQueries>(
        "party",
        ServerForceloadPartyQueries,
      );
    }
    return this._party;
  }

  /** Private backing field for lazy-loaded server_forceload_player queries */
  private _player?: ServerForceloadPlayerQueries;

  /**
   * Lazy-loaded singleton accessor for server_forceload_player
   *
   * Returns a ServerForceloadPlayerQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   *
   * @returns Singleton ServerForceloadPlayerQueries instance
   */
  get player(): ServerForceloadPlayerQueries {
    if (!this._player) {
      this._player = this.getOrCreateChild<ServerForceloadPlayerQueries>(
        "player",
        ServerForceloadPlayerQueries,
      );
    }
    return this._player;
  }
}
