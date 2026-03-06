import type { TableInfo, TableStructure } from "../types";
import { extractIdentifierFieldNames } from "./types";

/**
 * Base query class generator with child accessor patterns
 *
 * This module generates TypeScript base query classes that provide auto-generated
 * CRUD operations for database tables. Each class extends a generic BaseQueries
 * class and includes singleton child query accessors for hierarchical table
 * relationships, enabling clean navigation like `db.user.profiles.findAll()`.
 */

/**
 * Generates a base query class for a database table
 *
 * Creates a complete TypeScript class that extends BaseQueries with type-safe
 * CRUD operations, identifier validation, and singleton child query accessors.
 * The generated class serves as a foundation that user-written query classes
 * can extend to add custom functionality.
 *
 * @param table - Table metadata including all column information
 * @param structure - Hierarchical structure with child relationships
 * @returns Complete TypeScript source code for the base query class
 *
 * @remarks
 * Generated class features:
 * - Type-safe CRUD operations (find, create, update, delete)
 * - Identifier field validation for partial updates
 * - Singleton child query accessors (lazy-loaded, shared per pool)
 * - Proper type imports from shared package
 * - JSDoc documentation for IDE support
 *
 * Child query pattern:
 * - Child queries are singletons per database pool instance
 * - Lazy-loaded on first access for optimal performance
 * - Enables hierarchical access: `db.user.profiles.sessions.findAll()`
 *
 * Identifier validation:
 * - VALID_IDENTIFIER_FIELDS set contains primary key and unique columns
 * - Used by extractIdentifier to filter full entities to identifiers
 * - Prevents passing full entities where identifiers are expected
 *
 * @example
 * ```typescript
 * const userTable = {
 *   tableName: 'users',
 *   columns: [
 *     { columnName: 'id', isPrimaryKey: true, ... },
 *     { columnName: 'email', isUnique: true, ... }
 *   ]
 * };
 * const structure = {
 *   tableName: 'users',
 *   className: 'User',
 *   children: [{ tableName: 'user_profiles', ... }]
 * };
 * const code = generateBaseQueries(userTable, structure);
 * // Generates: UserBaseQueries class with profiles accessor
 * ```
 */
export function generateBaseQueries(
  table: TableInfo,
  structure: TableStructure,
): string {
  const { className, tableName, children } = structure;

  // Extract identifier fields (primary keys and unique columns)
  const identifierFields = extractIdentifierFieldNames(table);
  const identifierFieldsSet = `new Set([${identifierFields
    .map((f) => `'${f}'`)
    .join(", ")}])`;

  return `import type { Pool, PoolClient } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";
import type {
  ${className},
  ${className}Create,
  ${className}Row,
  ${className}Identifier,
  ${className}Filters,
} from "@createrington/shared/db/${tableName}.types";
${generateChildImports(children)}

/**
 * Auto-generated base queries for ${tableName} table
 * 
 * Provides type-safe CRUD operations and child query accessors.
 * Child query instances are singletons per database pool for optimal performance.
 * 
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
export class ${className}BaseQueries extends BaseQueries<{
  DbEntity: ${className}Row;
  Entity: ${className};
  Identifier: ${className}Identifier;
  Filters: ${className}Filters;
  Update: Partial<${className}>;
  Create: ${className}Create;
}> {
  /** Database table name */
  protected readonly table = "${tableName}";
  
  /**
   * Valid identifier fields for this table
   * 
   * Used by extractIdentifier to filter full entities to identifiers only,
   * skipping non-identifier fields when passed complete entities.
   * Includes primary key columns and columns with unique constraints.
   */
  protected readonly VALID_IDENTIFIER_FIELDS = ${identifierFieldsSet};

  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Child query singletons (shared across all instances using this pool)
${generateChildProperties(structure)}
}
`;
}

/**
 * Generates import statements for child query classes
 *
 * Creates both type-only imports (for property declarations) and implementation
 * imports (for instantiation) for all child query classes. Uses hierarchical
 * paths that match the directory structure.
 *
 * @param children - Array of child table structures
 * @returns Import statements string, or empty string if no children
 *
 * @remarks
 * Import strategy:
 * - Type imports: Used for property type declarations (tree-shakeable)
 * - Implementation imports: Used for actual instantiation (with alias to avoid conflicts)
 * - Paths converted from snake_case to directory structure (e.g., 'user_profiles' → 'user/profiles')
 *
 * @example
 * ```typescript
 * const children = [
 *   { tableName: 'user_profiles', className: 'UserProfile', ... },
 *   { tableName: 'user_sessions', className: 'UserSession', ... }
 * ];
 * const imports = generateChildImports(children);
 * // Generates:
 * // import type { UserProfileQueries } from "@/db/queries/user/profiles";
 * // import { UserProfileQueries as UserProfileQueriesImpl } from "@/db/queries/user/profiles";
 * // import type { UserSessionQueries } from "@/db/queries/user/sessions";
 * // import { UserSessionQueries as UserSessionQueriesImpl } from "@/db/queries/user/sessions";
 * ```
 */
function generateChildImports(children: TableStructure[]): string {
  if (children.length === 0) return "";

  // Generate type-only imports for property declarations
  const typeImports = children
    .map((child) => {
      const parts = child.tableName.split("_");
      return `import type { ${
        child.className
      }Queries } from "@/db/queries/${parts.join("/")}";`;
    })
    .join("\n");

  // Generate implementation imports with alias to avoid naming conflicts
  const actualImports = children
    .map((child) => {
      const parts = child.tableName.split("_");
      return `import { ${child.className}Queries as ${
        child.className
      }QueriesImpl } from "@/db/queries/${parts.join("/")}";`;
    })
    .join("\n");

  return `\n${typeImports}\n${actualImports}`;
}

/**
 * Generates child property accessor implementations
 *
 * Creates private backing fields and public getter methods for each child
 * query class. Getters implement singleton pattern with lazy loading,
 * ensuring each child query instance is created only once per parent and
 * shared across all operations.
 *
 * @param structure - Table structure with children relationships
 * @returns Property accessor code, or empty string if no children
 *
 * @remarks
 * Singleton pattern benefits:
 * - Child instances created only when first accessed (lazy loading)
 * - Single instance shared across all uses (memory efficient)
 * - Cached per database pool connection (thread-safe)
 * - Automatic cleanup when parent is garbage collected
 *
 * Accessor naming:
 * - Derived from child table name by removing parent prefix
 * - Example: 'user_profiles' child of 'user' → 'profiles' accessor
 * - Enables natural hierarchical access: db.user.profiles.sessions
 *
 * @example
 * ```typescript
 * const structure = {
 *   tableName: 'user',
 *   children: [
 *     { tableName: 'user_profiles', className: 'UserProfile', ... },
 *     { tableName: 'user_sessions', className: 'UserSession', ... }
 *   ]
 * };
 * const props = generateChildProperties(structure);
 * // Generates:
 * // private _profiles?: UserProfileQueries;
 * // get profiles(): UserProfileQueries {
 * //   if (!this._profiles) {
 * //     this._profiles = this.getOrCreateChild<UserProfileQueries>('profiles', UserProfileQueriesImpl);
 * //   }
 * //   return this._profiles;
 * // }
 * // (plus similar for sessions)
 * ```
 */
function generateChildProperties(structure: TableStructure): string {
  if (structure.children.length === 0) return "";

  return structure.children
    .map((child) => {
      // Derive property name by removing parent prefix
      const propName = getChildPropertyName(
        structure.tableName,
        child.tableName,
      );

      return `
  /** Private backing field for ${child.tableName} queries singleton */
  private _${propName}?: ${child.className}Queries;
  
  /**
   * Singleton accessor for ${child.tableName} queries
   * 
   * Lazy-loads and caches a ${child.className}Queries instance that shares
   * the same database connection. The instance is created once on first
   * access and reused for all subsequent calls.
   */
  get ${propName}(): ${child.className}Queries {
    if (!this._${propName}) {
      this._${propName} = this.getOrCreateChild<${child.className}Queries>('${propName}', ${child.className}QueriesImpl);
    }
    return this._${propName};
  }`;
    })
    .join("\n");
}

/**
 * Derives the property name for a child query accessor
 *
 * Extracts the appropriate property name by removing the parent table prefix
 * from the child table name and taking the next segment. This creates natural
 * hierarchical property names for nested table relationships.
 *
 * @param parentName - Parent table name (e.g., 'user')
 * @param childName - Child table name (e.g., 'user_profiles')
 * @returns Property name for the child accessor (e.g., 'profiles')
 *
 * @remarks
 * Naming algorithm:
 * 1. Remove parent prefix and underscore
 * 2. Take first remaining segment before next underscore
 * 3. Result becomes the property name
 *
 * Edge cases:
 * - Single segment after parent: uses that segment (user_profiles → profiles)
 * - Multiple segments: uses first segment (user_profile_settings → profile)
 * - Creates natural hierarchical access patterns
 *
 * @example
 * ```typescript
 * getChildPropertyName('user', 'user_profiles');
 * // Returns: 'profiles'
 *
 * getChildPropertyName('user', 'user_profile_settings');
 * // Returns: 'profile' (first segment after parent)
 *
 * getChildPropertyName('admin_log', 'admin_log_actions');
 * // Returns: 'actions'
 * ```
 */
function getChildPropertyName(parentName: string, childName: string): string {
  // Remove parent prefix and underscore, then take the first remaining segment
  return childName.replace(parentName + "_", "").split("_")[0];
}
