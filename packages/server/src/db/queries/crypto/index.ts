import type { Pool, PoolClient } from "pg";
import { CryptoCostQueries } from "@/db/queries/crypto/cost";
import { CryptoHoldingQueries } from "@/db/queries/crypto/holding";
import { CryptoOrderQueries } from "@/db/queries/crypto/order";
import { CryptoPriceQueries } from "@/db/queries/crypto/price";
import { CryptoTokenQueries } from "@/db/queries/crypto/token";
import { CryptoTransactionQueries } from "@/db/queries/crypto/transaction";
import { CryptoTreasuryQueries } from "@/db/queries/crypto/treasury";

/**
 * Namespace queries for crypto
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the 'crypto_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all CryptoQueries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class CryptoQueries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "crypto.actions")
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
   * - Cache key is prefixed with namespace (e.g., "crypto.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!CryptoQueries.queryInstances.has(this.db)) {
      CryptoQueries.queryInstances.set(this.db, new Map());
    }

    const cache = CryptoQueries.queryInstances.get(this.db)!;
    const fullKey = `crypto.${key}`;

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

  /** Private backing field for lazy-loaded crypto_cost queries */
  private _cost?: CryptoCostQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_cost
   * 
   * Returns a CryptoCostQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoCostQueries instance
   */
  get cost(): CryptoCostQueries {
    if (!this._cost) {
      this._cost = this.getOrCreateChild<CryptoCostQueries>('cost', CryptoCostQueries);
    }
    return this._cost;
  }

  /** Private backing field for lazy-loaded crypto_holding queries */
  private _holding?: CryptoHoldingQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_holding
   * 
   * Returns a CryptoHoldingQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoHoldingQueries instance
   */
  get holding(): CryptoHoldingQueries {
    if (!this._holding) {
      this._holding = this.getOrCreateChild<CryptoHoldingQueries>('holding', CryptoHoldingQueries);
    }
    return this._holding;
  }

  /** Private backing field for lazy-loaded crypto_order queries */
  private _order?: CryptoOrderQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_order
   * 
   * Returns a CryptoOrderQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoOrderQueries instance
   */
  get order(): CryptoOrderQueries {
    if (!this._order) {
      this._order = this.getOrCreateChild<CryptoOrderQueries>('order', CryptoOrderQueries);
    }
    return this._order;
  }

  /** Private backing field for lazy-loaded crypto_price queries */
  private _price?: CryptoPriceQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_price
   * 
   * Returns a CryptoPriceQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoPriceQueries instance
   */
  get price(): CryptoPriceQueries {
    if (!this._price) {
      this._price = this.getOrCreateChild<CryptoPriceQueries>('price', CryptoPriceQueries);
    }
    return this._price;
  }

  /** Private backing field for lazy-loaded crypto_token queries */
  private _token?: CryptoTokenQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_token
   * 
   * Returns a CryptoTokenQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoTokenQueries instance
   */
  get token(): CryptoTokenQueries {
    if (!this._token) {
      this._token = this.getOrCreateChild<CryptoTokenQueries>('token', CryptoTokenQueries);
    }
    return this._token;
  }

  /** Private backing field for lazy-loaded crypto_transaction queries */
  private _transaction?: CryptoTransactionQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_transaction
   * 
   * Returns a CryptoTransactionQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoTransactionQueries instance
   */
  get transaction(): CryptoTransactionQueries {
    if (!this._transaction) {
      this._transaction = this.getOrCreateChild<CryptoTransactionQueries>('transaction', CryptoTransactionQueries);
    }
    return this._transaction;
  }

  /** Private backing field for lazy-loaded crypto_treasury queries */
  private _treasury?: CryptoTreasuryQueries;

  /**
   * Lazy-loaded singleton accessor for crypto_treasury
   * 
   * Returns a CryptoTreasuryQueries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton CryptoTreasuryQueries instance
   */
  get treasury(): CryptoTreasuryQueries {
    if (!this._treasury) {
      this._treasury = this.getOrCreateChild<CryptoTreasuryQueries>('treasury', CryptoTreasuryQueries);
    }
    return this._treasury;
  }
}
