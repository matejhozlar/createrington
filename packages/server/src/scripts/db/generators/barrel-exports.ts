import type { TableInfo, TableStructure } from "../types";
import { snakeToPascal } from "../utils/naming";
import { collectAllStructures, getActualTables } from "../hierarchy/builder";

/**
 * Barrel export file generators for type and query re-exports
 *
 * This module generates index.ts files that serve as central export points
 * for different parts of the generated code structure. Barrel exports provide
 * clean import paths and organize the generated code into logical groupings.
 */

/**
 * Generates barrel export for the shared package (types only)
 *
 * Creates an index.ts file that re-exports all generated TypeScript types
 * from the shared package. This enables clean imports across the monorepo
 * and provides a single source of truth for database type definitions.
 *
 * @param tables - Array of all database tables to generate type exports for
 * @returns Complete TypeScript source code for the shared types barrel export
 *
 * @remarks
 * Generated exports structure:
 * - Base types (filters, operators, common utilities)
 * - Individual table type files (one per database table)
 * - All exports are type-only (no runtime code)
 *
 * Usage pattern:
 * ```typescript
 * // Consumers can import from single location:
 * import { User, Post, FilterOperator } from '@createrington/shared/db';
 * ```
 *
 * File location:
 * - Typically: packages/shared/src/db/index.ts
 * - Provides types to all packages in the monorepo
 *
 * @example
 * ```typescript
 * const tables = [
 *   { tableName: 'users', columns: [...] },
 *   { tableName: 'posts', columns: [...] }
 * ];
 * const barrel = generateSharedBarrelExport(tables);
 * // Generates:
 * // export * from "./base.types";
 * // export * from "./users.types";
 * // export * from "./posts.types";
 * ```
 */
export function generateSharedBarrelExport(tables: TableInfo[]): string {
  const typeExports = tables
    .map((table) => {
      return `export * from "./${table.tableName}.types";`;
    })
    .join("\n");

  return `/**
 * Barrel export for all shared database types
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */

// Database enum types
export * from "./database.types";

// Base types for filters and operators
export * from "./base.types";

// Generated table types
${typeExports}
`;
}

/**
 * Generates main barrel export for the generated database queries
 *
 * Creates the primary index.ts file that re-exports all generated base query
 * classes, database utilities, constants, and type definitions. This serves
 * as the main entry point for database operations in the application.
 *
 * @param tables - Array of all database tables to generate exports for
 * @returns Complete TypeScript source code for the main database barrel export
 *
 * @remarks
 * Generated exports are organized into logical sections:
 * 1. Type exports - Re-exported from shared package
 * 2. Base query classes - Auto-generated CRUD operations
 * 3. Database utilities - Query instance management and helpers
 * 4. Constants - Table names, field names, validation utilities
 *
 * File location:
 * - Typically: src/generated/db/index.ts
 * - Main entry point for all database operations
 *
 * Usage pattern:
 * ```typescript
 * import {
 *   UserBaseQueries,        // Base query class
 *   DatabaseQueries,        // Singleton instance manager
 *   DatabaseTable,          // Table name constants
 *   User                    // Type from shared package
 * } from '@/generated/db';
 * ```
 *
 * @example
 * ```typescript
 * const tables = [
 *   { tableName: 'users', columns: [...] },
 *   { tableName: 'posts', columns: [...] }
 * ];
 * const barrel = generateBarrelExport(tables);
 * // Generates organized exports with clear section headers
 * ```
 */
export function generateBarrelExport(tables: TableInfo[]): string {
  const baseExports = tables
    .map((table) => {
      const className = snakeToPascal(table.tableName);
      return `export { ${className}BaseQueries } from "./${table.tableName}.queries";`;
    })
    .join("\n");

  return `/**
 * Barrel export for all generated database queries
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */

// ============================================================================
// TYPE EXPORTS - Re-export from shared package
// ============================================================================

export * from "@createrington/shared/db";

// ============================================================================
// BASE QUERY CLASSES
// ============================================================================

${baseExports}

// ============================================================================
// DATABASE QUERY SINGLETON & HELPERS
// ============================================================================

export { DatabaseQueries } from "./db";
export { createQueryInstances, createQueries } from "./queries";
export type { QueryInstances } from "./queries";

// ============================================================================
// DATABASE CONSTANTS (Tables & Fields)
// ============================================================================

export { DatabaseTable } from "./constants";
export type { TableName, FieldName, CamelFieldName } from "./constants";
export {
  getAllTableNames,
  isValidTableName,
  getTableByName,
  snakeToCamel,
  camelToSnake,
} from "./constants";
`;
}

/**
 * Generates barrel export for actual (custom) query classes
 *
 * Creates an index.ts file that re-exports all user-written query classes
 * that extend the generated base classes. This provides a clean import path
 * for accessing custom query methods across the application.
 *
 * @param hierarchy - Table hierarchy structure with naming information
 * @returns Complete TypeScript source code for the actual queries barrel export
 *
 * @remarks
 * Export structure:
 * - Only includes actual database tables (excludes namespace-only structures)
 * - Maintains hierarchical directory structure in import paths
 * - Each export points to the custom query class file
 *
 * File location:
 * - Typically: src/db/queries/index.ts
 * - Located alongside user-written query implementations
 *
 * Path handling:
 * - Converts underscores to directory separators
 * - Example: 'admin_log_actions' → './admin/log/actions'
 * - Matches the hierarchical file structure
 *
 * Usage pattern:
 * ```typescript
 * import {
 *   UserQueries,              // Custom queries for users table
 *   AdminLogActionQueries     // Custom queries for admin_log_actions table
 * } from '@/db/queries';
 *
 * const userQueries = new UserQueries(pool);
 * await userQueries.findByEmail('test@example.com'); // Custom method
 * ```
 *
 * @example
 * ```typescript
 * const hierarchy = buildTableHierarchy([
 *   { tableName: 'users', ... },
 *   { tableName: 'admin_log_actions', ... }
 * ]);
 * const barrel = generateActualQueriesBarrel(hierarchy);
 * // Generates:
 * // export { UserQueries } from "./users";
 * // export { AdminLogActionQueries } from "./admin/log/actions";
 * ```
 */
export function generateActualQueriesBarrel(
  hierarchy: TableStructure[],
): string {
  // Filter to only actual database tables (not namespace-only structures)
  const actualTables = getActualTables(hierarchy);

  const exports = actualTables
    .map((structure) => {
      const className = structure.className;
      // Convert table name to directory path (e.g., 'admin_log_actions' → 'admin/log/actions')
      const parts = structure.tableName.split("_");
      return `export { ${className}Queries } from "./${parts.join("/")}";`;
    })
    .join("\n");

  return `/**
 * Barrel export for all actual query classes
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 * 
 * @example
 * import { PlayerQueries, AdminLogActionQueries } from "@/db/queries";
 */

${exports}
`;
}
