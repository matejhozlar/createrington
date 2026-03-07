/**
 * Base types generator for shared database utilities
 *
 * This module generates foundational TypeScript types used across all generated
 * table-specific types. These base types define the query filter system that
 * provides type-safe, expressive database queries with operator support.
 */

/**
 * Generates base types file for the shared package
 *
 * Creates TypeScript type definitions for the filter and operator system used
 * by all generated table types. These types enable type-safe, expressive query
 * construction with support for comparison operators, array operations, pattern
 * matching, and null handling.
 *
 * @returns Complete TypeScript source code for base filter types
 *
 * @remarks
 * Generated types:
 * - FilterOperators<T>: Generic operator interface supporting all SQL operations
 * - FilterValue<T>: Union type representing all possible filter values
 *
 * Operator categories:
 * 1. Comparison operators: $eq, $ne, $gt, $gte, $lt, $lte
 * 2. Array operators: $in, $nin (for matching against lists)
 * 3. Pattern matching: $like (case-sensitive), $ilike (case-insensitive)
 * 4. Null handling: $exists (IS NULL / IS NOT NULL)
 * 5. Range operators: $between (inclusive range)
 *
 * Type safety:
 * - Operators constrained to appropriate types (e.g., $gt only for comparable values)
 * - Pattern matching operators ($like, $ilike) typed as string
 * - Array operators accept arrays of the base type
 * - Null explicitly supported in FilterValue union
 *
 * Usage in generated code:
 * ```typescript
 * // Generated table type uses these base types:
 * export type UserFilters = {
 *   id?: FilterValue<number>;        // Can use $eq, $gt, $in, etc.
 *   email?: FilterValue<string>;     // Can use $like, $ilike, etc.
 *   created_at?: FilterValue<Date>;  // Can use $between, $gte, etc.
 * };
 * ```
 *
 * Query examples enabled by these types:
 * ```typescript
 * // Direct value (implicit $eq)
 * { id: 123 }
 *
 * // Operator usage
 * { age: { $gte: 18, $lt: 65 } }
 * { email: { $like: '%@example.com' } }
 * { status: { $in: ['active', 'pending'] } }
 * { deleted_at: { $exists: false } }  // IS NULL
 * { score: { $between: [0, 100] } }
 *
 * // Null handling
 * { optional_field: null }  // IS NULL
 * ```
 *
 * File location:
 * - Typically: packages/shared/src/db/base.types.ts
 * - Imported by all generated table type files
 * - Re-exported through the shared package barrel
 *
 * @example
 * ```typescript
 * const baseTypes = generateBaseTypes();
 * writeFile('./shared/db/base.types.ts', baseTypes);
 * // Creates the foundation for all table-specific filter types
 * ```
 */
export function generateBaseTypes(): string {
  return `/**
 * Base types for database query filters and operators
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */

/**
 * Filter operators for database queries
 */
export type FilterOperators<T> = {
  /** Equal to */
  $eq?: T;
  /** Not equal to */
  $ne?: T;
  /** Greater than */
  $gt?: T;
  /** Greater than or equal to */
  $gte?: T;
  /** Less than */
  $lt?: T;
  /** Less than or equal to */
  $lte?: T;
  /** In array (matches any value in the array) */
  $in?: T[];
  /** Not in array (doesn't match any value in the array) */
  $nin?: T[];
  /** SQL LIKE pattern match (case-sensitive) */
  $like?: string;
  /** SQL ILIKE pattern match (case-insensitive) */
  $ilike?: string;
  /** IS NOT NULL (true) or IS NULL (false) */
  $exists?: boolean;
  /** Between two values (inclusive) */
  $between?: [T, T];
};

/**
 * Filter value type for database queries
 * Can be a direct value, an operator object, or null
 */
export type FilterValue<T> = T | FilterOperators<T> | null;
`;
}
