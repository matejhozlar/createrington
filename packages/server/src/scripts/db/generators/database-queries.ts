import type { TableStructure } from "../types";
import { snakeToCamel } from "../utils/naming";
import { getRootStructures } from "../hierarchy/builder";

/**
 * Unified DatabaseQueries class generator with transaction support
 *
 * This module generates the main DatabaseQueries class that serves as the
 * central access point for all database operations. It provides lazy-loaded
 * query instances, transaction management, and a clean API for database
 * interactions throughout the application.
 */

/**
 * Generates the unified DatabaseQueries class
 *
 * Creates a comprehensive TypeScript class that provides:
 * - Lazy-loaded singleton accessors for all root-level query classes
 * - Transaction management with automatic rollback on errors
 * - Transaction nesting detection to prevent double-wrapping
 * - Type-safe access to all database operations
 *
 * @param hierarchy - Complete table hierarchy with root tables at depth 0
 * @returns Complete TypeScript source code for the DatabaseQueries class
 *
 * @remarks
 * Design patterns:
 * - Singleton pattern: Each query class instantiated once per DatabaseQueries instance
 * - Lazy loading: Query classes created only when first accessed
 * - Dependency injection: Pool or PoolClient passed through constructor
 * - Transaction scope: New instance created with transaction client
 *
 * Transaction behavior:
 * - Creates new client from pool for each transaction
 * - Detects if already in transaction to prevent nesting issues
 * - Automatic COMMIT on success, ROLLBACK on error
 * - Client properly released in finally block
 * - All queries within callback share the same transaction
 *
 * Hierarchy access:
 * - Root tables accessible directly (e.g., db.user)
 * - Child tables through parent (e.g., db.user.profiles)
 * - Deep nesting supported (e.g., db.user.profile.settings)
 *
 * Usage patterns:
 * ```typescript
 * // Normal operations (auto-commit)
 * await db.user.create({ email: 'test@example.com' });
 * const users = await db.user.findAll();
 *
 * // Transactional operations (atomic)
 * await db.inTransaction(async (tx) => {
 *   const user = await tx.user.create({ ... });
 *   await tx.user.profiles.create({ userId: user.id, ... });
 *   // Both succeed or both fail together
 * });
 *
 * // Nested transactions (reuses existing)
 * await db.inTransaction(async (tx) => {
 *   await tx.user.create({ ... });
 *   // This reuses the same transaction
 *   await tx.inTransaction(async (nested) => {
 *     await nested.user.profiles.create({ ... });
 *   });
 * });
 * ```
 *
 * @example
 * ```typescript
 * const hierarchy = buildTableHierarchy([
 *   { tableName: 'users', columns: [...] },
 *   { tableName: 'posts', columns: [...] },
 *   { tableName: 'user_profiles', columns: [...] }  // child of users
 * ]);
 * const code = generateDatabaseQueries(hierarchy);
 * // Generates DatabaseQueries class with:
 * // - db.users accessor (root)
 * // - db.posts accessor (root)
 * // - db.users.profiles accessor (child, via users)
 * ```
 */
export function generateDatabaseQueries(hierarchy: TableStructure[]): string {
  const rootTables = getRootStructures(hierarchy);

  return `import type { Pool, PoolClient } from "pg";
import logger from "@/logger.global";
${generateImports(rootTables)}

/**
 * Unified database queries class
 * 
 * Central access point for all database operations with transaction support.
 * Query instances are lazy-loaded singletons that share the same database
 * connection (pool or transaction client).
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 * 
 * @example
 * // Normal usage (auto-commit after each operation)
 * import { db } from "@/db";
 * await db.player.create({ ... });
 * await db.player.balance.findAll();
 * 
 * @example
 * // Transactional usage (atomic operations)
 * import { db } from "@/db";
 * await db.inTransaction(async (tx) => {
 *   await tx.player.create({ ... });
 *   await tx.player.balance.create({ ... });
 *   // Both succeed together or both fail (automatic rollback)
 * });
 * 
 * @example
 * // Error handling with transactions
 * try {
 *   await db.inTransaction(async (tx) => {
 *     await tx.user.create({ ... });
 *     throw new Error('Simulated error');
 *     await tx.user.profiles.create({ ... });  // Never executed
 *   });
 * } catch (error) {
 *   // Transaction automatically rolled back
 *   console.error('Transaction failed:', error);
 * }
 */
export class DatabaseQueries {
  constructor(protected db: Pool | PoolClient) {}
${generateGetters(rootTables)}

  /**
   * Execute a callback within a database transaction
   * 
   * Creates a new DatabaseQueries instance using a dedicated transaction client.
   * All database operations performed within the callback will be part of the
   * same atomic transaction - they either all succeed or all fail together.
   * 
   * Transaction lifecycle:
   * 1. Acquires client from pool
   * 2. Begins transaction (BEGIN)
   * 3. Executes callback with transaction-enabled queries
   * 4. On success: Commits transaction (COMMIT)
   * 5. On error: Rolls back transaction (ROLLBACK)
   * 6. Always: Releases client back to pool
   * 
   * Nested transaction handling:
   * - Detects if already in transaction via isInTransaction()
   * - Reuses existing transaction instead of creating nested one
   * - Prevents deadlocks and maintains single transaction scope
   * 
   * @param callback - Async function receiving transaction-enabled query instance
   * @returns The result returned by the callback
   * @throws Propagates any error thrown by callback after rollback
   * 
   * @example
   * // Transfer funds between accounts atomically
   * await db.inTransaction(async (tx) => {
   *   const sender = await tx.account.findById(senderId);
   *   const receiver = await tx.account.findById(receiverId);
   *   
   *   if (sender.balance < amount) {
   *     throw new Error('Insufficient funds');
   *   }
   *   
   *   await tx.account.update(senderId, { balance: sender.balance - amount });
   *   await tx.account.update(receiverId, { balance: receiver.balance + amount });
   *   
   *   return { success: true };
   * });
   */
  async inTransaction<T>(
    callback: (tx: DatabaseQueries) => Promise<T>
  ): Promise<T> {
    // If already in transaction, reuse this instance to prevent nesting
    if (this.isInTransaction()) {
      logger.debug("Already in transaction, reusing existing client");
      return callback(this);
    }

    // Acquire dedicated client from pool for this transaction
    const client = await (this.db as Pool).connect();

    try {
      await client.query("BEGIN");
      logger.debug("Transaction started");

      // Create new DatabaseQueries instance with transaction client
      const txQueries = new DatabaseQueries(client);
      const result = await callback(txQueries);

      await client.query("COMMIT");
      logger.debug("Transaction committed");

      return result;
    } catch (error) {
      // Rollback on any error to maintain data integrity
      await client.query("ROLLBACK");
      logger.error("Transaction rolled back:", error);
      throw error;
    } finally {
      // Always release client back to pool
      client.release();
    }
  }

  /**
   * Check if this instance is using a transaction client
   * 
   * Determines whether this DatabaseQueries instance is operating within
   * a transaction by checking for the presence of processID property,
   * which exists on PoolClient but not on Pool.
   * 
   * @returns true if using a transaction client, false if using pool directly
   * 
   * @remarks
   * Used internally by inTransaction() to detect nesting and prevent
   * creating nested transactions, which PostgreSQL doesn't support
   * (without savepoints).
   * 
   * @example
   * const db = new DatabaseQueries(pool);
   * console.log(db.isInTransaction());  // false
   * 
   * await db.inTransaction(async (tx) => {
   *   console.log(tx.isInTransaction());  // true
   * });
   */
  isInTransaction(): boolean {
    return "processID" in this.db;
  }

  /**
   * Get the underlying database pool or client
   * 
   * Provides access to the raw pg Pool or PoolClient for advanced use cases
   * that require direct database access. Most operations should use the
   * type-safe query methods instead.
   * 
   * @returns The underlying Pool or PoolClient instance
   * 
   * @remarks
   * Use with caution:
   * - Bypasses type safety of generated query methods
   * - May break transaction isolation if misused
   * - Prefer using query methods for standard operations
   * 
   * Valid use cases:
   * - Custom SQL queries not covered by generated methods
   * - Database-specific operations (LISTEN/NOTIFY, etc.)
   * - Integration with external libraries requiring raw client
   * 
   * @example
   * // Custom raw query
   * const result = await db.getDb().query(
   *   'SELECT * FROM custom_view WHERE ...'
   * );
   * 
   * // PostgreSQL LISTEN/NOTIFY
   * const client = db.getDb();
   * if ('on' in client) {  // Check if PoolClient
   *   client.on('notification', (msg) => { ... });
   *   await client.query('LISTEN channel_name');
   * }
   */
  getDb(): Pool | PoolClient {
    return this.db;
  }
}
`;
}

/**
 * Generates import statements for all root-level query classes
 *
 * Creates imports for query classes that will be directly accessible from
 * the DatabaseQueries instance. Only root-level tables (depth 0) need
 * imports as child tables are accessed through their parents.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Import statements for all root query classes
 *
 * @remarks
 * - Converts table names to directory paths (e.g., 'admin_logs' → 'admin/logs')
 * - Only root tables need imports; children imported by their parents
 * - Maintains hierarchical file structure in import paths
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'posts', className: 'Post', ... }
 * ];
 * const imports = generateImports(rootTables);
 * // Returns:
 * // import { UserQueries } from "@/db/queries/users";
 * // import { PostQueries } from "@/db/queries/posts";
 * ```
 */
function generateImports(rootTables: TableStructure[]): string {
  return rootTables
    .map((t) => {
      const parts = t.tableName.split("_");
      return `import { ${t.className}Queries } from "@/db/queries/${parts.join(
        "/",
      )}";`;
    })
    .join("\n");
}

/**
 * Generates lazy-loaded getter methods for root-level query classes
 *
 * Creates property accessors that instantiate query classes on first access
 * and cache them for subsequent uses. This singleton pattern ensures efficient
 * resource usage while maintaining clean API surface.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Property getter implementations for all root tables
 *
 * @remarks
 * Lazy loading benefits:
 * - Query classes created only when actually used
 * - Memory efficient for large schemas
 * - Single instance per DatabaseQueries (singleton per connection)
 * - Fast subsequent accesses (cached reference)
 *
 * Property naming:
 * - Converted to camelCase (e.g., 'user_profiles' → 'userProfiles')
 * - Follows TypeScript naming conventions
 * - Provides clean, intuitive API
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'user_accounts', className: 'UserAccount', ... }
 * ];
 * const getters = generateGetters(rootTables);
 * // Generates:
 * // private _userAccounts?: UserAccountQueries;
 * // get userAccounts(): UserAccountQueries {
 * //   if (!this._userAccounts) {
 * //     this._userAccounts = new UserAccountQueries(this.db);
 * //   }
 * //   return this._userAccounts;
 * // }
 * ```
 */
function generateGetters(rootTables: TableStructure[]): string {
  return rootTables
    .map((t) => {
      const propName = snakeToCamel(t.tableName);
      return `
  /** Private backing field for lazy-loaded ${t.tableName} queries */
  private _${propName}?: ${t.className}Queries;

  /**
   * Lazy-loaded singleton accessor for ${t.tableName} queries
   * 
   * Creates and caches a ${t.className}Queries instance on first access.
   * All subsequent accesses return the same cached instance, ensuring
   * efficient resource usage and consistent state.
   */
  get ${propName}(): ${t.className}Queries {
    if (!this._${propName}) {
      this._${propName} = new ${t.className}Queries(this.db);
    }
    return this._${propName};
  }`;
    })
    .join("\n");
}
