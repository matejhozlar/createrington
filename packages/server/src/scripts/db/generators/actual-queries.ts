import type { TableStructure } from "../types";

/**
 * Actual query class scaffolding generator
 *
 * This module generates scaffold files for custom query implementations that
 * extend the auto-generated base query classes. These scaffold files are created
 * only once and are never overwritten, allowing developers to add custom query
 * methods while maintaining the benefits of auto-generated CRUD operations.
 */

/**
 * Generates a scaffold file for custom query methods
 *
 * Creates a TypeScript class that extends the auto-generated base query class,
 * providing a safe location for developers to add custom query methods without
 * risk of their code being overwritten during regeneration.
 *
 * @param structure - Table structure metadata containing naming information
 * @returns Complete TypeScript source code for the custom query class scaffold
 *
 * @remarks
 * Generated file structure:
 * - Imports base query class from generated directory
 * - Imports required pg types (Pool, PoolClient)
 * - Creates empty extension class with proper constructor
 * - Includes JSDoc comment encouraging custom method addition
 *
 * File lifecycle:
 * - Generated ONCE when table is first detected
 * - Never overwritten by subsequent generations (via writeFileIfNotExists)
 * - Developer owns the file and can modify freely
 * - Changes persist across schema regenerations
 *
 * Usage pattern:
 * ```typescript
 * export class UserQueries extends UserBaseQueries {
 *   constructor(db: Pool | PoolClient) {
 *     super(db);
 *   }
 *
 *   // Developer adds custom methods:
 *   async findByEmail(email: string) {
 *     return this.db.query(...);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * const structure = {
 *   tableName: 'users',
 *   className: 'User',
 *   // ... other fields
 * };
 * const scaffold = generateActualQueries(structure);
 * writeFileIfNotExists('./queries/users.queries.ts', scaffold);
 * // File created only if it doesn't exist
 * ```
 */
export function generateActualQueries(structure: TableStructure): string {
  const { className, tableName } = structure;

  return `import type { Pool, PoolClient } from "pg";
import { ${className}BaseQueries } from "@/generated/db/${tableName}.queries";

/**
 * Custom queries for ${tableName} table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ${className}Queries extends ${className}BaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<${className}[]> {
  //   const result = await this.db.query<${className}>(
  //     \`SELECT * FROM ${tableName} WHERE ...\`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
`;
}
