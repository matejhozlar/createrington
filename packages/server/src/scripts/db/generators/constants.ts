import type { TableInfo } from "../types";
import { snakeToCamel } from "../utils/naming";

/**
 * Database constants generator for type-safe table and field access
 *
 * This module generates a comprehensive constants file that provides type-safe
 * access to all database table and field names. It creates constants in multiple
 * formats (snake_case for SQL, camelCase for TypeScript) along with helper
 * functions for validation and conversion.
 */

/**
 * Generates the complete database constants file
 *
 * Creates a TypeScript file containing structured constants for all database
 * tables and their fields, along with type-safe helper functions. This enables
 * compile-time validation of table and field names throughout the application,
 * preventing typos and ensuring consistency between database schema and code.
 *
 * @param tables - Array of all database tables with their column metadata
 * @returns Complete TypeScript source code for the constants file
 *
 * @remarks
 * Generated structure:
 * 1. DatabaseTable constant object - Nested structure with table/field names
 * 2. Helper types - Type-safe string literals for tables and fields
 * 3. Helper functions - Validation, lookup, and case conversion utilities
 *
 * Constant format:
 * ```typescript
 * DatabaseTable.TABLE_NAME = {
 *   TABLE: "table_name",
 *   FIELDS: { COLUMN_NAME: "column_name" },      // snake_case for SQL
 *   CAMEL_FIELDS: { COLUMN_NAME: "columnName" }  // camelCase for TypeScript
 * }
 * ```
 *
 * Use cases:
 * - Type-safe query construction without string literals
 * - Field name validation at compile time
 * - Consistent naming across database and application layers
 * - IDE autocomplete for table and field names
 * - Runtime validation of dynamic table/field names
 *
 * @example
 * ```typescript
 * const tables = [
 *   {
 *     tableName: 'users',
 *     columns: [
 *       { columnName: 'id', ... },
 *       { columnName: 'email_address', ... }
 *     ]
 *   }
 * ];
 * const constants = generateConstants(tables);
 * // Generates:
 * // DatabaseTable.USERS.TABLE === "users"
 * // DatabaseTable.USERS.FIELDS.EMAIL_ADDRESS === "email_address"
 * // DatabaseTable.USERS.CAMEL_FIELDS.EMAIL_ADDRESS === "emailAddress"
 * ```
 */
export function generateConstants(tables: TableInfo[]): string {
  const timestamp = new Date().toISOString();
  const tableConstants = tables.map(generateTableConstant).join("\n");

  return `/**
 * Auto-generated database constants
 * 
 * Provides type-safe access to table and field names in both snake_case
 * (for database operations) and camelCase (for application logic).
 * 
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 * Generated: ${timestamp}
 * 
 * @example
 * // Access table names
 * DatabaseTable.PLAYER.TABLE // "player"
 * 
 * @example
 * // Access field names (snake_case for database queries)
 * DatabaseTable.PLAYER.FIELDS.MINECRAFT_USERNAME // "minecraft_username"
 * 
 * @example
 * // Access field names (camelCase for TypeScript code)
 * DatabaseTable.PLAYER.CAMEL_FIELDS.MINECRAFT_USERNAME // "minecraftUsername"
 * 
 * @example
 * // Use in queries with type safety
 * const tableName = DatabaseTable.PLAYER.TABLE;
 * const fieldName = DatabaseTable.PLAYER.FIELDS.MINECRAFT_USERNAME;
 * await db.query(\`SELECT \${fieldName} FROM \${tableName}\`);
 */
export const DatabaseTable = {
${tableConstants}
} as const;

${generateHelperTypes()}

${generateHelperFunctions()}
`;
}

/**
 * Generates a constant object for a single database table
 *
 * Creates a nested constant structure containing the table name and all
 * field names in both snake_case and camelCase formats. All values are
 * marked as const literals for maximum type safety.
 *
 * @param table - Table metadata including name and columns
 * @returns TypeScript constant object definition for the table
 *
 * @remarks
 * Naming conventions:
 * - Constant name: SCREAMING_SNAKE_CASE (e.g., USER_PROFILES)
 * - TABLE value: snake_case (e.g., "user_profiles")
 * - FIELDS keys: SCREAMING_SNAKE_CASE (e.g., EMAIL_ADDRESS)
 * - FIELDS values: snake_case (e.g., "email_address")
 * - CAMEL_FIELDS keys: SCREAMING_SNAKE_CASE (e.g., EMAIL_ADDRESS)
 * - CAMEL_FIELDS values: camelCase (e.g., "emailAddress")
 *
 * @example
 * ```typescript
 * const table = {
 *   tableName: 'user_profiles',
 *   columns: [
 *     { columnName: 'user_id', ... },
 *     { columnName: 'display_name', ... }
 *   ]
 * };
 * const constant = generateTableConstant(table);
 * // Generates:
 * // USER_PROFILES: {
 * //   TABLE: "user_profiles" as const,
 * //   FIELDS: {
 * //     USER_ID: "user_id" as const,
 * //     DISPLAY_NAME: "display_name" as const,
 * //   },
 * //   CAMEL_FIELDS: {
 * //     USER_ID: "userId" as const,
 * //     DISPLAY_NAME: "displayName" as const,
 * //   },
 * // },
 * ```
 */
function generateTableConstant(table: TableInfo): string {
  const constName = table.tableName.toUpperCase();
  const snakeFields = generateFieldConstants(table, false);
  const camelFields = generateFieldConstants(table, true);

  return `  ${constName}: {
    TABLE: "${table.tableName}" as const,
    FIELDS: {
${snakeFields}
    },
    CAMEL_FIELDS: {
${camelFields}
    },
  },`;
}

/**
 * Generates field constants in either snake_case or camelCase format
 *
 * Creates constant entries for all columns in a table, with field names
 * in the requested format. Constants use SCREAMING_SNAKE_CASE keys with
 * string literal values for type safety.
 *
 * @param table - Table metadata with columns
 * @param useCamelCase - true for camelCase values, false for snake_case
 * @returns Formatted constant entries for all fields
 *
 * @remarks
 * - Keys always in SCREAMING_SNAKE_CASE (e.g., EMAIL_ADDRESS)
 * - Values in snake_case or camelCase based on useCamelCase parameter
 * - All values marked as const literals for TypeScript type narrowing
 * - Maintains column order from database schema
 *
 * @example
 * ```typescript
 * const table = {
 *   tableName: 'users',
 *   columns: [
 *     { columnName: 'first_name', ... },
 *     { columnName: 'last_name', ... }
 *   ]
 * };
 *
 * generateFieldConstants(table, false);
 * // Returns:
 * //   FIRST_NAME: "first_name" as const,
 * //   LAST_NAME: "last_name" as const,
 *
 * generateFieldConstants(table, true);
 * // Returns:
 * //   FIRST_NAME: "firstName" as const,
 * //   LAST_NAME: "lastName" as const,
 * ```
 */
function generateFieldConstants(
  table: TableInfo,
  useCamelCase: boolean,
): string {
  return table.columns
    .map((col) => {
      const fieldConstName = col.columnName.toUpperCase();
      const value = useCamelCase
        ? snakeToCamel(col.columnName)
        : col.columnName;
      return `      ${fieldConstName}: "${value}" as const,`;
    })
    .join("\n");
}

/**
 * Generates type-safe helper types for table and field name inference
 *
 * Creates TypeScript type aliases that extract literal string types from
 * the DatabaseTable constant, enabling compile-time validation and IDE
 * autocomplete for table and field names throughout the codebase.
 *
 * @returns TypeScript type definitions for table and field names
 *
 * @remarks
 * Generated types:
 * - TableName: Union of all table name literals
 * - FieldName<T>: Union of field names for a specific table (snake_case)
 * - CamelFieldName<T>: Union of field names for a specific table (camelCase)
 *
 * Type inference benefits:
 * - Compile-time validation of table/field names
 * - IDE autocomplete for all valid names
 * - Type narrowing in conditional logic
 * - Generic constraints for type-safe functions
 *
 * @example
 * ```typescript
 * // Generated types enable:
 * function queryTable(table: TableName) { ... }  // Only accepts valid tables
 *
 * function getField<T extends keyof typeof DatabaseTable>(
 *   table: T,
 *   field: FieldName<T>  // Only accepts fields from the specified table
 * ) { ... }
 *
 * // Usage:
 * getField('USERS', 'email_address');  // ✓ Valid
 * getField('USERS', 'invalid_field');  // ✗ Compile error
 * getField('USERS', 'order_id');       // ✗ Compile error (field from different table)
 * ```
 */
function generateHelperTypes(): string {
  return `/**
 * Type-safe table name type
 * 
 * Union type of all valid table names in the database.
 * Enables compile-time validation and IDE autocomplete.
 */
export type TableName = typeof DatabaseTable[keyof typeof DatabaseTable]["TABLE"];

/**
 * Type-safe snake_case field names for a given table
 * 
 * Extracts the union of all valid field names (in snake_case format)
 * for the specified table. Used for database queries and operations.
 * 
 * @typeParam T - The table constant key (e.g., 'USERS', 'POSTS')
 */
export type FieldName<T extends keyof typeof DatabaseTable> = typeof DatabaseTable[T]["FIELDS"][keyof typeof DatabaseTable[T]["FIELDS"]];

/**
 * Type-safe camelCase field names for a given table
 * 
 * Extracts the union of all valid field names (in camelCase format)
 * for the specified table. Used for application-level TypeScript code.
 * 
 * @typeParam T - The table constant key (e.g., 'USERS', 'POSTS')
 */
export type CamelFieldName<T extends keyof typeof DatabaseTable> = typeof DatabaseTable[T]["CAMEL_FIELDS"][keyof typeof DatabaseTable[T]["CAMEL_FIELDS"]];`;
}

/**
 * Generate helper functions
 */
function generateHelperFunctions(): string {
  return `/**
 * Get all table names as an array
 * 
 * Returns an array containing all valid table names from the database schema.
 * Useful for iteration, validation, or dynamic operations across all tables.
 * 
 * @returns Array of all table names in the database
 */
export function getAllTableNames(): TableName[] {
  return Object.values(DatabaseTable).map((t) => t.TABLE);
}

/**
 * Check if a string is a valid table name
 * 
 * Type guard function that validates whether a string corresponds to a known
 * table name in the database. Narrows the type to TableName when true.
 * 
 * @param name - String to validate as a table name
 * @returns true if the string is a valid table name, false otherwise
 * 
 * @example
 * const userInput = getUserInput();
 * if (isValidTableName(userInput)) {
 *   // TypeScript knows userInput is now TableName
 *   processTable(userInput);
 * }
 */
export function isValidTableName(name: string): name is TableName {
  return getAllTableNames().includes(name as TableName);
}

/**
 * Get the table constant object by table name
 * 
 * Looks up and returns the complete constant object for a given table name,
 * providing access to all field constants. Returns undefined if the table
 * name is not found.
 * 
 * @param tableName - The table name to look up
 * @returns The table constant object, or undefined if not found
 * 
 * @example
 * const userTable = getTableByName('users');
 * if (userTable) {
 *   console.log(userTable.FIELDS.EMAIL_ADDRESS);  // "email_address"
 *   console.log(userTable.CAMEL_FIELDS.EMAIL_ADDRESS);  // "emailAddress"
 * }
 */
export function getTableByName(tableName: string): typeof DatabaseTable[keyof typeof DatabaseTable] | undefined {
  return Object.values(DatabaseTable).find((t) => t.TABLE === tableName);
}

/**
 * Convert a snake_case field name to camelCase
 * 
 * Transforms database-style snake_case identifiers to TypeScript-style
 * camelCase. Useful when converting between database and application layers.
 * 
 * @param snakeCase - The snake_case string to convert
 * @returns The converted camelCase string
 * 
 * @example
 * snakeToCamel('email_address');    // Returns: "emailAddress"
 * snakeToCamel('user_profile_id');  // Returns: "userProfileId"
 * snakeToCamel('id');               // Returns: "id"
 */
export function snakeToCamel(snakeCase: string): string {
  return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase field name to snake_case
 * 
 * Transforms TypeScript-style camelCase identifiers to database-style
 * snake_case. Useful when constructing database queries from TypeScript code.
 * 
 * @param camelCase - The camelCase string to convert
 * @returns The converted snake_case string
 * 
 * @example
 * camelToSnake('emailAddress');    // Returns: "email_address"
 * camelToSnake('userProfileId');   // Returns: "user_profile_id"
 * camelToSnake('id');              // Returns: "id"
 */
export function camelToSnake(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => \`_\${letter.toLowerCase()}\`);
}`;
}
