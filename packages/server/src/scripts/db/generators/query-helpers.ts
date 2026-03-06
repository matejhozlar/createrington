import type { TableStructure } from "../types";
import { snakeToCamel } from "../utils/naming";
import { getRootStructures } from "../hierarchy/builder";

/**
 * Query initialization helpers generator
 *
 * This module generates utility functions and types for creating query instances
 * in different contexts (normal operations vs transactions). It provides both
 * a singleton Q object pattern for convenience and transaction-aware factory
 * functions for atomic operations.
 */

/**
 * Generates query initialization helper functions and types
 *
 * Creates a comprehensive set of utilities for working with query instances:
 * - QueryInstances interface: Type-safe interface for all query classes
 * - createQueryInstances(): Factory for normal pool-based queries
 * - createQueries(): Factory for transaction client-based queries
 * - Helper documentation for exporting individual queries
 *
 * @param hierarchy - Complete table hierarchy with root tables at depth 0
 * @returns Complete TypeScript source code for query helper utilities
 *
 * @remarks
 * Design patterns:
 * - Factory pattern: Functions create properly initialized query instances
 * - Singleton pattern: Single Q object for application-wide queries
 * - Dependency injection: Database connection passed to factories
 * - Type safety: Strong typing through QueryInstances interface
 *
 * Usage scenarios:
 * 1. Normal operations: Use createQueryInstances(pool) to create Q object
 * 2. Transactions: Use createQueries(client) inside transaction callbacks
 * 3. Individual exports: Destructure Q for cleaner imports
 *
 * The Q object pattern:
 * - Provides application-wide singleton query instances
 * - Clean, concise syntax: Q.user.findAll()
 * - Hierarchical access: Q.user.profiles.sessions
 * - Initialized once at application startup
 *
 * Transaction pattern:
 * - Creates new instances with transaction client
 * - Ensures all operations share same transaction
 * - Maintains same API as normal Q object
 * - Automatically participates in rollback/commit
 *
 * @example
 * ```typescript
 * const hierarchy = buildTableHierarchy([
 *   { tableName: 'users', columns: [...] },
 *   { tableName: 'posts', columns: [...] }
 * ]);
 * const helpers = generateQueryHelpers(hierarchy);
 *
 * // Generated code enables:
 * // 1. Normal usage
 * export const Q = createQueryInstances(pool);
 * await Q.users.findAll();
 *
 * // 2. Transaction usage
 * await transaction(pool, async (client) => {
 *   const txQ = createQueries(client);
 *   await txQ.users.create({ ... });
 * });
 *
 * // 3. Individual exports
 * export const { users, posts } = Q;
 * await users.findAll();
 * ```
 */
export function generateQueryHelpers(hierarchy: TableStructure[]): string {
  const rootTables = getRootStructures(hierarchy);

  return `import type { Pool, PoolClient } from "pg";
${generateImports(rootTables)}

${generateQueryInstancesInterface(rootTables)}

${generateCreateQueryInstances(rootTables)}

${generateCreateQueries(rootTables)}

${generateExportHelper(rootTables)}
`;
}

/**
 * Generates import statements for all root-level query classes
 *
 * Creates imports for the query classes that will be included in the
 * QueryInstances interface and factory functions. Only root-level tables
 * need imports as child tables are accessed through their parents.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Import statements for all root query classes
 *
 * @remarks
 * - Converts table names to hierarchical directory paths
 * - Only root tables need direct imports
 * - Child queries accessed through parent instances
 * - Maintains consistency with file structure
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'admin_logs', className: 'AdminLog', ... }
 * ];
 * const imports = generateImports(rootTables);
 * // Returns:
 * // import { UserQueries } from "@/db/queries/users";
 * // import { AdminLogQueries } from "@/db/queries/admin/logs";
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
 * Generates the QueryInstances interface definition
 *
 * Creates a TypeScript interface that describes the shape of the query
 * instances object, providing type safety for the Q object and ensuring
 * consistent typing across the application.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Complete interface definition for QueryInstances
 *
 * @remarks
 * Interface benefits:
 * - Type-safe access to all query instances
 * - IDE autocomplete for available queries
 * - Compile-time validation of query existence
 * - Consistent type across normal and transaction contexts
 *
 * Property naming:
 * - Uses camelCase for TypeScript conventions
 * - Example: 'user_profiles' → 'userProfiles'
 * - Provides clean, intuitive API
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'posts', className: 'Post', ... }
 * ];
 * const interface = generateQueryInstancesInterface(rootTables);
 * // Generates:
 * // export interface QueryInstances {
 * //   users: UserQueries;
 * //   posts: PostQueries;
 * // }
 * ```
 */
function generateQueryInstancesInterface(rootTables: TableStructure[]): string {
  const properties = rootTables
    .map((t) => {
      const propName = snakeToCamel(t.tableName);
      return `  ${propName}: ${t.className}Queries;`;
    })
    .join("\n");

  return `/**
 * Query singleton instances type
 * 
 * Defines the structure of the query instances object, providing type-safe
 * access to all root-level query classes. This interface is used by both
 * normal and transaction-based query factories.
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export interface QueryInstances {
${properties}
}`;
}

/**
 * Generates the createQueryInstances factory function
 *
 * Creates a function that instantiates all root-level query classes using
 * a database pool. This is the primary way to create the application-wide
 * Q object for normal (non-transactional) database operations.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Complete function implementation for createQueryInstances
 *
 * @remarks
 * Function characteristics:
 * - Takes Pool parameter (connection pool)
 * - Returns QueryInstances object with all queries
 * - Creates new instances for each root table
 * - Each instance shares the same pool connection
 * - Typically called once at application startup
 *
 * Usage pattern:
 * 1. Call at startup: `const Q = createQueryInstances(pool)`
 * 2. Export Q object for application-wide use
 * 3. Import Q in any module: `import { Q } from '@/db'`
 * 4. Use queries: `await Q.users.findAll()`
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'posts', className: 'Post', ... }
 * ];
 * const factory = generateCreateQueryInstances(rootTables);
 * // Generates function that returns:
 * // {
 * //   users: new UserQueries(db),
 * //   posts: new PostQueries(db)
 * // }
 *
 * // Application usage:
 * import { createQueryInstances } from '@/generated/db/queries';
 * import pool from '@/db';
 * export const Q = createQueryInstances(pool);
 * ```
 */
function generateCreateQueryInstances(rootTables: TableStructure[]): string {
  const properties = rootTables
    .map((t) => {
      const propName = snakeToCamel(t.tableName);
      return `    ${propName}: new ${t.className}Queries(db),`;
    })
    .join("\n");

  return `/**
 * Create query singleton instances for normal usage
 * 
 * Instantiates all root-level query classes using the provided database pool.
 * The returned object provides type-safe access to all database operations
 * through a clean, hierarchical API.
 * 
 * Typical usage: Call once at application startup to create the global Q object.
 * 
 * @param db - Database pool for executing queries
 * @returns Object containing all query instances, following QueryInstances interface
 * 
 * @example
 * \`\`\`typescript
 * // In db/index.ts
 * import { createQueryInstances } from "@/generated/db/queries";
 * import pool from "@/db/pool";
 * 
 * export const Q = createQueryInstances(pool);
 * 
 * // In any module
 * import { Q } from "@/db";
 * 
 * await Q.player.get({ id: 1 });
 * await Q.player.balance.findAll();
 * await Q.admin.log.actions.create({ ... });
 * \`\`\`
 */
export function createQueryInstances(db: Pool): QueryInstances {
  return {
${properties}
  };
}`;
}

/**
 * Generates the createQueries factory function for transactions
 *
 * Creates a function that instantiates all root-level query classes using
 * a transaction client. This enables atomic operations where all queries
 * share the same transaction context and can be committed or rolled back
 * together.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Complete function implementation for createQueries
 *
 * @remarks
 * Function characteristics:
 * - Takes PoolClient parameter (transaction client)
 * - Returns QueryInstances object with same API as normal Q
 * - All queries share the transaction context
 * - Participates in transaction commit/rollback
 * - Used inside transaction callback functions
 *
 * Transaction lifecycle:
 * 1. Begin transaction and acquire client
 * 2. Call createQueries(client) to get transaction-aware queries
 * 3. Execute database operations
 * 4. Commit on success or rollback on error
 * 5. Release client back to pool
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'accounts', className: 'Account', ... }
 * ];
 * const factory = generateCreateQueries(rootTables);
 *
 * // Application usage:
 * import { transaction } from "@/db/utils/transactions";
 * import { createQueries } from "@/generated/db/queries";
 * import pool from "@/db";
 *
 * await transaction(pool, async (client) => {
 *   const Q = createQueries(client);
 *
 *   // Both queries in same transaction
 *   const user = await Q.users.create({ ... });
 *   await Q.accounts.create({ userId: user.id, ... });
 *
 *   // Both committed together, or both rolled back on error
 * });
 * ```
 */
function generateCreateQueries(rootTables: TableStructure[]): string {
  const properties = rootTables
    .map((t) => {
      const propName = snakeToCamel(t.tableName);
      return `    ${propName}: new ${t.className}Queries(client),`;
    })
    .join("\n");

  return `/**
 * Create query instances using a transaction client
 * 
 * Instantiates all root-level query classes using the provided transaction
 * client. All queries created through this function will participate in the
 * same transaction, enabling atomic multi-table operations.
 * 
 * Use this function inside transaction callbacks to ensure all database
 * operations are part of the same atomic transaction.
 * 
 * @param client - Transaction client from pool.connect() or transaction helper
 * @returns Object containing all query instances using the transaction client
 * 
 * @example
 * \`\`\`typescript
 * import { transaction } from "@/db/utils/transactions";
 * import { createQueries } from "@/generated/db/queries";
 * import pool from "@/db";
 * 
 * await transaction(pool, async (client) => {
 *   const Q = createQueries(client);
 *   
 *   // All operations in same transaction
 *   await Q.player.create({ ... });
 *   await Q.player.balance.create({ ... });
 *   await Q.admin.log.actions.create({ ... });
 *   
 *   // Automatically committed if callback succeeds
 *   // Automatically rolled back if callback throws
 * });
 * \`\`\`
 */
export function createQueries(client: PoolClient): QueryInstances {
  return {
${properties}
  };
}`;
}

/**
 * Generates helper documentation for individual query exports
 *
 * Creates a TypeScript comment with copy-paste ready code for exporting
 * individual query instances from the Q object. This enables cleaner
 * imports in modules that only need specific query classes.
 *
 * @param rootTables - Array of root-level table structures
 * @returns Type alias and documentation comment for individual exports
 *
 * @remarks
 * Export pattern benefits:
 * - Shorter import statements in consuming modules
 * - Clear dependency on specific query classes
 * - Maintains type safety through destructuring
 * - Still uses the same singleton instances
 *
 * Usage:
 * 1. Copy the suggested export statement to db/index.ts
 * 2. Import specific queries: `import { users } from '@/db'`
 * 3. Use directly: `await users.findAll()`
 *
 * @example
 * ```typescript
 * const rootTables = [
 *   { tableName: 'users', className: 'User', ... },
 *   { tableName: 'posts', className: 'Post', ... },
 *   { tableName: 'comments', className: 'Comment', ... }
 * ];
 * const helper = generateExportHelper(rootTables);
 *
 * // Generates comment:
 * // Copy this to your db/index.ts:
 * // export const { users, posts, comments } = Q;
 *
 * // Enables:
 * import { users, posts } from '@/db';
 * await users.findAll();
 * await posts.findByAuthor(userId);
 * ```
 */
function generateExportHelper(rootTables: TableStructure[]): string {
  const exportNames = rootTables
    .map((t) => snakeToCamel(t.tableName))
    .join(", ");

  return `/**
 * Helper type for extracting individual query instances from Q object
 * 
 * Use this pattern to export individual query instances for cleaner imports:
 * 
 * In your db/index.ts file:
 * \`\`\`typescript
 * export const { ${exportNames} } = Q;
 * \`\`\`
 * 
 * Then import specific queries where needed:
 * \`\`\`typescript
 * import { ${exportNames.split(", ").slice(0, 2).join(", ")} } from "@/db";
 * 
 * await ${rootTables[0] ? snakeToCamel(rootTables[0].tableName) : "query"}.findAll();
 * \`\`\`
 */
export type IndividualQueryExports = QueryInstances;`;
}
