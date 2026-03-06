import type { TableStructure } from "../types";

/**
 * Namespace query class generator for hierarchical table organization
 *
 * This module generates "namespace-only" query classes that don't correspond
 * to actual database tables but serve as organizational containers for related
 * table queries. These classes enable clean hierarchical access patterns like
 * db.user.profile.settings for deeply nested table relationships.
 */

/**
 * Generates a namespace query class for grouping related tables
 *
 * Creates a TypeScript class that serves as a container for child query classes,
 * implementing singleton pattern with lazy loading. Namespace classes don't have
 * their own database operations but provide organized access to child tables
 * that share a common prefix in their naming.
 *
 * @param structure - Table structure marked as namespace-only (isNamespaceOnly: true)
 * @returns Complete TypeScript source code for the namespace query class
 *
 * @remarks
 * Purpose and design:
 * - Organizational only - no actual database table
 * - Groups related tables by common prefix
 * - Enables hierarchical access: db.admin.log.actions
 * - Maintains singleton pattern for child instances
 * - Shares connection pool with parent
 *
 * Singleton pattern:
 * - Static WeakMap registry shared across all instances
 * - Child instances cached per database connection
 * - Lazy loading - children created on first access
 * - WeakMap allows garbage collection when connection closes
 *
 * Naming example:
 * If tables are: admin, admin_logs, admin_log_actions
 * - 'admin' → actual table (generates base query class)
 * - 'admin_log' → namespace (generates this class)
 * - Structure: db.admin.log.actions
 *
 * When to generate:
 * - Only for structures where isNamespaceOnly === true
 * - When intermediate prefixes exist without actual tables
 * - To maintain clean hierarchical organization
 *
 * @example
 * ```typescript
 * // For a namespace 'admin_log' grouping 'admin_log_actions':
 * const structure = {
 *   tableName: 'admin_log',
 *   className: 'AdminLog',
 *   isNamespaceOnly: true,
 *   children: [
 *     { tableName: 'admin_log_actions', className: 'AdminLogAction', ... }
 *   ]
 * };
 * const code = generateNamespaceQueries(structure);
 * // Generates AdminLogQueries class with:
 * // - actions getter for AdminLogActionQueries
 * // - Singleton caching for optimal performance
 * // Usage: db.admin.log.actions.findAll()
 * ```
 */
export function generateNamespaceQueries(structure: TableStructure): string {
  const { className, tableName, children } = structure;

  return `import type { Pool, PoolClient } from "pg";
${generateChildImports(children)}

/**
 * Namespace queries for ${tableName}
 * 
 * This is a pure organizational namespace that groups related query classes.
 * It does not correspond to an actual database table but provides hierarchical
 * access to child tables that share the '${tableName}_' prefix.
 * 
 * Uses singleton pattern with lazy loading for optimal performance:
 * - Child instances created once per database connection
 * - Cached in WeakMap for automatic garbage collection
 * - Shared across all ${className}Queries instances using same connection
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class ${className}Queries {
  /**
   * Static singleton registry for child query instances
   * 
   * Uses WeakMap keyed by database connection (Pool or PoolClient):
   * - Allows garbage collection when connection is closed
   * - Prevents memory leaks in long-running applications
   * - Each connection has its own cache map
   * - Keys are fully qualified (e.g., "${tableName}.actions")
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
   * - Cache key is prefixed with namespace (e.g., "${tableName}.actions")
   * - Ensures child shares the same database connection as parent
   * - Type-safe through generic parameter T
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T
  ): T {
    // Initialize cache for this connection if not exists
    if (!${className}Queries.queryInstances.has(this.db)) {
      ${className}Queries.queryInstances.set(this.db, new Map());
    }

    const cache = ${className}Queries.queryInstances.get(this.db)!;
    const fullKey = \`${tableName}.\${key}\`;

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
${generateChildProperties(structure)}
}
`;
}

/**
 * Generates import statements for all child query classes
 *
 * Creates imports for the query classes that will be accessible through
 * this namespace. Converts table names to hierarchical directory paths
 * matching the file structure.
 *
 * @param children - Array of child table structures under this namespace
 * @returns Import statements for all child query classes
 *
 * @remarks
 * - Each child could be either an actual table or another namespace
 * - Import paths use directory separators (e.g., 'admin/log/actions')
 * - Matches the hierarchical file structure generated by the tool
 *
 * @example
 * ```typescript
 * const children = [
 *   { tableName: 'admin_log_actions', className: 'AdminLogAction', ... },
 *   { tableName: 'admin_log_events', className: 'AdminLogEvent', ... }
 * ];
 * const imports = generateChildImports(children);
 * // Returns:
 * // import { AdminLogActionQueries } from "@/db/queries/admin/log/actions";
 * // import { AdminLogEventQueries } from "@/db/queries/admin/log/events";
 * ```
 */
function generateChildImports(children: TableStructure[]): string {
  return children
    .map((child) => {
      // Convert snake_case table name to directory path
      const parts = child.tableName.split("_");
      return `import { ${
        child.className
      }Queries } from "@/db/queries/${parts.join("/")}";`;
    })
    .join("\n");
}

/**
 * Generates lazy-loaded property accessors for all child queries
 *
 * Creates private backing fields and public getter methods for each child,
 * implementing the lazy-loaded singleton pattern. Children are instantiated
 * only when first accessed and cached for subsequent uses.
 *
 * @param structure - Namespace structure with children to generate accessors for
 * @returns Property accessor implementations for all children
 *
 * @remarks
 * Pattern for each child:
 * 1. Private backing field (_childName)
 * 2. Public getter that checks cache
 * 3. Lazy instantiation through getOrCreateChild
 * 4. Type-safe return value
 *
 * Property naming:
 * - Derived by removing parent prefix from child name
 * - Example: 'admin_log_actions' → 'actions' (parent: 'admin_log')
 * - Uses first segment after parent prefix
 *
 * @example
 * ```typescript
 * const structure = {
 *   tableName: 'admin_log',
 *   children: [
 *     { tableName: 'admin_log_actions', className: 'AdminLogAction', ... },
 *     { tableName: 'admin_log_events', className: 'AdminLogEvent', ... }
 *   ]
 * };
 * const props = generateChildProperties(structure);
 * // Generates:
 * // private _actions?: AdminLogActionQueries;
 * // get actions(): AdminLogActionQueries { ... }
 * // private _events?: AdminLogEventQueries;
 * // get events(): AdminLogEventQueries { ... }
 * ```
 */
function generateChildProperties(structure: TableStructure): string {
  return structure.children
    .map((child) => {
      // Derive property name by removing parent prefix
      const propName = getChildPropertyName(
        structure.tableName,
        child.tableName,
      );

      return `
  /** Private backing field for lazy-loaded ${child.tableName} queries */
  private _${propName}?: ${child.className}Queries;

  /**
   * Lazy-loaded singleton accessor for ${child.tableName}
   * 
   * Returns a ${child.className}Queries instance that shares this namespace's
   * database connection. The instance is created once on first access and
   * cached for all subsequent calls.
   * 
   * @returns Singleton ${child.className}Queries instance
   */
  get ${propName}(): ${child.className}Queries {
    if (!this._${propName}) {
      this._${propName} = this.getOrCreateChild<${child.className}Queries>('${propName}', ${child.className}Queries);
    }
    return this._${propName};
  }`;
    })
    .join("\n");
}

/**
 * Derives the property name for a child query accessor
 *
 * Extracts the appropriate property name by removing the parent namespace
 * prefix from the child table name. This creates clean, intuitive property
 * names for hierarchical access.
 *
 * @param parentName - Parent namespace name (e.g., 'admin_log')
 * @param childName - Child table name (e.g., 'admin_log_actions')
 * @returns Property name for the child accessor (e.g., 'actions')
 *
 * @remarks
 * Algorithm:
 * 1. Remove parent prefix and underscore (e.g., 'admin_log_' from 'admin_log_actions')
 * 2. Take first segment before next underscore (e.g., 'actions')
 * 3. Result becomes the property name
 *
 * Handles multi-level nesting:
 * - Parent: 'admin_log', Child: 'admin_log_actions' → 'actions'
 * - Parent: 'admin_log', Child: 'admin_log_action_types' → 'action'
 * - Parent: 'user', Child: 'user_profiles' → 'profiles'
 *
 * @example
 * ```typescript
 * getChildPropertyName('admin_log', 'admin_log_actions');
 * // Returns: 'actions'
 *
 * getChildPropertyName('admin_log', 'admin_log_action_types');
 * // Returns: 'action' (first segment after parent)
 *
 * getChildPropertyName('user', 'user_profile_settings');
 * // Returns: 'profile'
 * ```
 */
function getChildPropertyName(parentName: string, childName: string): string {
  // Remove parent prefix and underscore, then take first remaining segment
  return childName.replace(parentName + "_", "").split("_")[0];
}
