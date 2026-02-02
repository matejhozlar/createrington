/**
 * Shared types for the database query system generator
 *
 * This module defines the core type definitions used throughout the database
 * schema introspection and type generation process. These types support the
 * automatic generation of TypeScript types and query helpers from PostgreSQL
 * database schemas.
 */

/**
 * Represents metadata about a single database column
 *
 * Contains all relevant information needed to generate TypeScript types
 * and validate queries against the database schema.
 */
export interface ColumnInfo {
  /** The column's name as defined in the database */
  columnName: string;

  /** The SQL data type (e.g., 'integer', 'character varying', 'timestamp') */
  dataType: string;

  /** The underlying PostgreSQL data type name (e.g., 'int4', 'varchar', 'timestamptz') */
  udtName: string;

  /** Whether the column accepts NULL values */
  isNullable: boolean;

  /** Whether this column is part of the table's primary key */
  isPrimaryKey: boolean;

  /** Whether this column has a UNIQUE constraint */
  isUnique: boolean;

  /** Whether the column has a default value defined */
  hasDefault: boolean;

  /** Precision for numeric types (total number of digits), null for non-numeric types */
  numericPrecision: number | null;

  /** Scale for numeric types (number of decimal places), null for non-numeric types */
  numericScale: number | null;
}

/**
 * Represents complete metadata about a database table
 *
 * Aggregates all column information for a single table, serving as the
 * primary data structure for table-level schema introspection.
 */
export interface TableInfo {
  /** The table's name as defined in the database */
  tableName: string;

  /** Array of all columns in this table with their complete metadata */
  columns: ColumnInfo[];
}

/**
 * Represents the hierarchical structure of database tables
 *
 * Used to organize tables into a tree structure based on foreign key
 * relationships or naming conventions, enabling namespace-based organization
 * of generated types.
 */
export interface TableStructure {
  /** The table's name as defined in the database */
  tableName: string;

  /** The generated TypeScript class/namespace name (PascalCase) */
  className: string;

  /** Name of the parent table in the hierarchy, if applicable */
  parentTable?: string;

  /** Child tables nested under this table in the hierarchy */
  children: TableStructure[];

  /** The depth level in the hierarchy tree (0 for root tables) */
  depth: number;

  /** Whether this represents only a namespace grouping without actual table data */
  isNamespaceOnly: boolean;
}

/**
 * Cached schema metadata for incremental generation
 *
 * Persists the database schema state to disk, enabling detection of schema
 * changes between generator runs and avoiding unnecessary regeneration.
 */
export interface SchemaCache {
  /** Cache format version for compatibility checking */
  version: string;

  /** ISO timestamp of when this cache was generated */
  generatedAt: string;

  /** Map of table names to their column metadata */
  tables: {
    [tableName: string]: {
      /** Column metadata for this table */
      columns: ColumnInfo[];
    };
  };
}

/**
 * Types of schema changes that can be detected
 *
 * Used for categorizing differences between the current database schema
 * and the cached schema from the previous generation.
 */
export type SchemaChangeType =
  | "table_added" // New table detected in the database
  | "table_removed" // Previously known table no longer exists
  | "column_added" // New column added to an existing table
  | "column_removed" // Previously known column no longer exists
  | "column_modified"; // Column metadata has changed (type, nullability, etc.)

/**
 * Represents a single detected schema change
 *
 * Documents a specific difference between the cached schema and the current
 * database schema, used for logging and changelog generation.
 */
export interface SchemaChange {
  /** The category of change that occurred */
  type: SchemaChangeType;

  /** The table affected by this change */
  table: string;

  /** The specific column affected (undefined for table-level changes) */
  column?: string;

  /** Human-readable description of the change with additional context */
  detail?: string;
}

/**
 * Summary of a completed type generation run
 *
 * Provides metrics and outcomes from the generation process, useful for
 * logging, validation, and CI/CD integration.
 */
export interface GenerationResult {
  /** List of generated file paths (relative or absolute) */
  files: string[];

  /** List of scaffold file paths created for new tables */
  scaffolds: string[];

  /** Total number of database tables processed */
  tablesFound: number;

  /** Number of schema changes detected since last generation */
  changes: number;
}

/**
 * Configuration and paths for the generation process
 *
 * Encapsulates all directory paths and project structure information needed
 * by the generator, supporting both monorepo and standalone project layouts.
 */
export interface GenerationContext {
  /** Root directory of the current project/package */
  projectRoot: string;

  /** Root directory of the monorepo (if applicable) */
  monorepoRoot: string;

  /** Root directory of the shared package containing common types */
  sharedPackageRoot: string;

  /** Directory where shared TypeScript types are generated */
  sharedTypesDir: string;

  /** Directory for generated database types and helpers */
  generatedDir: string;

  /** Directory containing hand-written query implementations */
  actualQueriesDir: string;

  /** Path to the schema cache file for incremental generation */
  cacheFile: string;

  /** Path to the changelog file documenting schema changes */
  changelogFile: string;
}

/**
 * Represents metadata about a PostgreSQL enum type
 */
export interface EnumTypeInfo {
  /** The enum type's namme as defined in the database */
  typeName: string;

  /** Ordered array of enum values */
  values: string[];
}

/**
 * Complete database schema information
 */
export interface DatabaseSchema {
  /** All tables in the database */
  tables: TableInfo[];

  /** All custom enum types */
  enums: EnumTypeInfo[];
}
