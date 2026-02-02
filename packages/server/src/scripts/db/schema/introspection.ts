import pg from "pg";
import type {
  TableInfo,
  ColumnInfo,
  EnumTypeInfo,
  DatabaseSchema,
} from "../types";

/**
 * Database schema introspection utilities
 *
 * This module provides functionality to read and analyze PostgreSQL database
 * schemas through the information_schema and system catalogs. It extracts
 * complete metadata about tables, columns, constraints, and data types needed
 * for TypeScript type generation.
 */

/**
 * Database connection configuration
 *
 * Wraps the node-postgres pool configuration for type safety and
 * consistent connection management across introspection operations.
 */
interface DatabaseConfig {
  /** PostgreSQL connection pool configuration */
  pool: pg.PoolConfig;
}

/**
 * Reads complete schema information from a PostgreSQL database
 *
 * Performs comprehensive schema introspection by querying the database's
 * information_schema and system catalogs. Retrieves all tables from the
 * public schema along with their complete column metadata, constraints,
 * and relationships.
 *
 * @param config - Database connection configuration with pool settings
 * @returns Array of complete table metadata including all columns and constraints
 *
 * @remarks
 * - Only reads from the 'public' schema (configurable in getTableNames)
 * - Establishes a new connection pool for the operation
 * - Automatically closes the connection pool when complete
 * - Reads base tables only (excludes views, foreign tables, etc.)
 *
 * @throws Will throw if database connection fails or queries are invalid
 *
 * @example
 * ```typescript
 * const tables = await readSchemaFromDatabase({
 *   pool: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'myapp',
 *     user: 'postgres',
 *     password: 'password'
 *   }
 * });
 * console.log(`Found ${tables.length} tables`);
 * ```
 */
export async function readSchemaFromDatabase(
  config: DatabaseConfig,
): Promise<DatabaseSchema> {
  const db = new pg.Pool(config.pool);

  try {
    const tableNames = await getTableNames(db);
    const tables: TableInfo[] = [];

    for (const tableName of tableNames) {
      const columns = await getTableColumns(db, tableName);
      const primaryKeys = await getPrimaryKeys(db, tableName);
      const uniqueKeys = await getUniqueKeys(db, tableName);

      tables.push({
        tableName,
        columns: buildColumnInfo(columns, primaryKeys, uniqueKeys),
      });
    }

    const enums = await getEnumTypes(db);

    return { tables, enums };
  } finally {
    await db.end();
  }
}

/**
 * Retrieves all table names from the public schema
 *
 * Queries the information_schema to get a list of all base tables
 * (excludes views, materialized views, foreign tables, etc.) in
 * alphabetical order.
 *
 * @param db - Active PostgreSQL connection pool
 * @returns Array of table names, sorted alphabetically
 *
 * @remarks
 * - Only includes BASE TABLE type (excludes VIEW, FOREIGN TABLE, etc.)
 * - Hard-coded to 'public' schema - modify query if other schemas needed
 * - Results are ordered for consistent, predictable output
 *
 * @example
 * ```typescript
 * const tables = await getTableNames(pool);
 * // ['users', 'posts', 'comments', ...]
 * ```
 */
async function getTableNames(db: pg.Pool): Promise<string[]> {
  const result = await db.query<{ table_name: string }>(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );

  return result.rows.map((row) => row.table_name);
}

/**
 * Raw column metadata from PostgreSQL information_schema
 *
 * Represents a single row from the information_schema.columns view,
 * containing all metadata needed to generate TypeScript types.
 */
interface ColumnRow {
  /** Column name as defined in the database */
  column_name: string;

  /** SQL standard data type (e.g., 'integer', 'character varying') */
  data_type: string;

  /** PostgreSQL-specific underlying type (e.g., 'int4', 'varchar') */
  udt_name: string;

  /** 'YES' if nullable, 'NO' if NOT NULL constraint */
  is_nullable: string;

  /** Default value expression, or null if no default */
  column_default: string | null;

  /** For numeric types: total number of digits */
  numeric_precision: number | null;

  /** For numeric types: number of decimal places */
  numeric_scale: number | null;
}

/**
 * Retrieves all custom enum types from the database
 *
 * Queries PostgreSQL system catalogs to get all user-defined ENUM types
 * along with their possible values in the correct order.
 *
 * @param db - Active PostgreSQL connection pool
 * @returns Array of enum type information with values
 */
async function getEnumTypes(db: pg.Pool): Promise<EnumTypeInfo[]> {
  // First, get all enum type names
  const typesResult = await db.query<{ type_name: string }>(
    `SELECT DISTINCT t.typname as type_name
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE n.nspname = 'public'
     ORDER BY t.typname`,
  );

  const enums: EnumTypeInfo[] = [];

  // For each enum type, get its values
  for (const { type_name } of typesResult.rows) {
    const valuesResult = await db.query<{ enum_label: string }>(
      `SELECT e.enumlabel as enum_label
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON t.typnamespace = n.oid
       WHERE n.nspname = 'public'
       AND t.typname = $1
       ORDER BY e.enumsortorder`,
      [type_name],
    );

    enums.push({
      typeName: type_name,
      values: valuesResult.rows.map((row) => row.enum_label),
    });
  }

  return enums;
}

/**
 * Retrieves detailed column information for a specific table
 *
 * Queries information_schema.columns to get complete metadata for all
 * columns in the specified table, including types, nullability, defaults,
 * and numeric precision.
 *
 * @param db - Active PostgreSQL connection pool
 * @param tableName - Name of the table to inspect
 * @returns Array of column metadata rows in ordinal (definition) order
 *
 * @remarks
 * - Results ordered by ordinal_position (column definition order)
 * - Includes system-level metadata (udt_name) for accurate type mapping
 * - Numeric precision/scale fields are null for non-numeric types
 *
 * @example
 * ```typescript
 * const columns = await getTableColumns(pool, 'users');
 * // [
 * //   { column_name: 'id', data_type: 'integer', ... },
 * //   { column_name: 'email', data_type: 'character varying', ... }
 * // ]
 * ```
 */
async function getTableColumns(
  db: pg.Pool,
  tableName: string,
): Promise<ColumnRow[]> {
  const result = await db.query<ColumnRow>(
    `SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      numeric_precision,
      numeric_scale
     FROM information_schema.columns
     WHERE table_schema = 'public'
     AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName],
  );

  return result.rows;
}

/**
 * Retrieves primary key column names for a table
 *
 * Queries PostgreSQL system catalogs (pg_index, pg_attribute) to identify
 * which columns are part of the table's primary key constraint.
 *
 * @param db - Active PostgreSQL connection pool
 * @param tableName - Name of the table to inspect
 * @returns Set of column names that are part of the primary key
 *
 * @remarks
 * - Uses pg_index.indisprimary to identify primary key indexes
 * - Supports composite primary keys (multiple columns)
 * - Returns empty set if table has no primary key
 * - Uses regclass type casting for safe table name resolution
 *
 * @example
 * ```typescript
 * const pks = await getPrimaryKeys(pool, 'users');
 * // Set(['id']) for single-column PK
 * // Set(['user_id', 'role_id']) for composite PK
 * ```
 */
async function getPrimaryKeys(
  db: pg.Pool,
  tableName: string,
): Promise<Set<string>> {
  const result = await db.query<{ column_name: string }>(
    `SELECT a.attname as column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid
     AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass
     AND i.indisprimary`,
    [tableName],
  );

  return new Set(result.rows.map((r) => r.column_name));
}

/**
 * Retrieves unique constraint column names for a table (excluding primary keys)
 *
 * Queries PostgreSQL system catalogs to identify columns with UNIQUE
 * constraints that are not part of the primary key. Useful for identifying
 * alternative keys and business constraints.
 *
 * @param db - Active PostgreSQL connection pool
 * @param tableName - Name of the table to inspect
 * @returns Set of column names with unique constraints (excluding PK columns)
 *
 * @remarks
 * - Uses pg_index.indisunique to identify unique indexes
 * - Excludes primary key columns (already handled separately)
 * - Supports both single-column and composite unique constraints
 * - Includes both explicit UNIQUE constraints and unique indexes
 *
 * @example
 * ```typescript
 * const unique = await getUniqueKeys(pool, 'users');
 * // Set(['email', 'username']) - columns with UNIQUE constraints
 * ```
 */
async function getUniqueKeys(
  db: pg.Pool,
  tableName: string,
): Promise<Set<string>> {
  const result = await db.query<{ column_name: string }>(
    `SELECT a.attname as column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid
     AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass
     AND i.indisunique
     AND NOT i.indisprimary`,
    [tableName],
  );

  return new Set(result.rows.map((r) => r.column_name));
}

/**
 * Transforms raw database column rows into structured ColumnInfo objects
 *
 * Converts the raw query results from information_schema into the structured
 * ColumnInfo format used throughout the type generation system. Enriches
 * columns with constraint information from separate queries.
 *
 * @param columns - Raw column metadata rows from information_schema
 * @param primaryKeys - Set of column names that are primary keys
 * @param uniqueKeys - Set of column names with unique constraints
 * @returns Array of structured ColumnInfo objects ready for type generation
 *
 * @remarks
 * - Preserves column order from the database (ordinal_position)
 * - Converts information_schema string flags to booleans
 * - Enriches with constraint information from separate queries
 * - All fields required for TypeScript type mapping are populated
 *
 * @example
 * ```typescript
 * const columns = buildColumnInfo(
 *   [{ column_name: 'id', is_nullable: 'NO', ... }],
 *   new Set(['id']),
 *   new Set([])
 * );
 * // [{ columnName: 'id', isNullable: false, isPrimaryKey: true, ... }]
 * ```
 */
function buildColumnInfo(
  columns: ColumnRow[],
  primaryKeys: Set<string>,
  uniqueKeys: Set<string>,
): ColumnInfo[] {
  return columns.map((col) => ({
    columnName: col.column_name,
    dataType: col.data_type,
    udtName: col.udt_name,
    isNullable: col.is_nullable === "YES",
    isPrimaryKey: primaryKeys.has(col.column_name),
    isUnique: uniqueKeys.has(col.column_name),
    hasDefault: col.column_default !== null,
    numericPrecision: col.numeric_precision,
    numericScale: col.numeric_scale,
  }));
}
