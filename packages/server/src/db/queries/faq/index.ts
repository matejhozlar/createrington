import type { Pool, PoolClient } from "pg";
import { FaqEntryQueries } from "@/db/queries/faq/entry";
import { FaqWelcomeQueries } from "@/db/queries/faq/welcome";

/**
 * Namespace queries for faq
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'faq_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all FaqQueries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate
 */
export class FaqQueries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "faq.actions")
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
   * - Cache key is prefixed with namespace (e.g., "faq.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!FaqQueries.queryInstances.has(this.db)) {
      FaqQueries.queryInstances.set(this.db, new Map());
    }

    const cache = FaqQueries.queryInstances.get(this.db)!;
    const fullKey = `faq.${key}`;

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

  /** Private backing field for lazy-loaded faq_entry queries */
  private _entry?: FaqEntryQueries;

  /**
   * Lazy-loaded singleton accessor for faq_entry
   * 
   * Returns a FaqEntryQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton FaqEntryQueries instance
   */
  get entry(): FaqEntryQueries {
    if (!this._entry) {
      this._entry = this.getOrCreateChild<FaqEntryQueries>('entry', FaqEntryQueries);
    }
    return this._entry;
  }

  /** Private backing field for lazy-loaded faq_welcome queries */
  private _welcome?: FaqWelcomeQueries;

  /**
   * Lazy-loaded singleton accessor for faq_welcome
   * 
   * Returns a FaqWelcomeQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton FaqWelcomeQueries instance
   */
  get welcome(): FaqWelcomeQueries {
    if (!this._welcome) {
      this._welcome = this.getOrCreateChild<FaqWelcomeQueries>('welcome', FaqWelcomeQueries);
    }
    return this._welcome;
  }
}
