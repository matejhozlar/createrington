import "@/logger.global";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import config from "@/config";

/**
 * PostgreSQL schema dumping utility
 *
 * This script extracts the complete database schema from a live PostgreSQL
 * database and organizes it into individual files for version control and
 * reproducibility. It handles custom types (enums), tables, and functions,
 * creating both component files and initialization scripts.
 */

const poolConfig = config.database.pool;
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Output directory structure
const DB_ROOT = path.resolve(__dirname, "../../../../../db");
const SCHEMA_DIR = path.resolve(DB_ROOT, "schema");
const TABLES_DIR = path.resolve(DB_ROOT, "tables");
const FUNCTIONS_DIR = path.resolve(DB_ROOT, "functions");
const TYPES_DIR = path.resolve(DB_ROOT, "types");
const BACKUP_DIR = path.resolve(DB_ROOT, "backup");
const OUTPUT_DIRS = [TYPES_DIR, TABLES_DIR, FUNCTIONS_DIR, SCHEMA_DIR];

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    return false;
  }
}

async function hasAnyEntries(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.length > 0;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function rotateOutputsToBackup(): Promise<void> {
  if (await hasAnyEntries(BACKUP_DIR)) {
    await fs.rm(BACKUP_DIR, { recursive: true, force: true });
  }
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  for (const dir of OUTPUT_DIRS) {
    if (await pathExists(dir)) {
      const folderName = path.basename(dir);
      const dest = path.join(BACKUP_DIR, folderName);

      await fs.rm(dest, { recursive: true, force: true });

      await fs.rename(dir, dest);
    }
  }

  for (const dir of OUTPUT_DIRS) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Executes a PostgreSQL query via psql command and returns results
 *
 * Uses the psql command-line tool to execute SQL queries against the
 * configured database. Output is formatted as tab-separated values (-t)
 * with no alignment (-A) for easy parsing.
 *
 * @param sql - SQL query to execute
 * @returns Query results as a string, trimmed of whitespace
 * @throws Error if query execution fails
 *
 * @remarks
 * Connection parameters:
 * - Uses poolConfig from application config
 * - Password passed via PGPASSWORD environment variable
 * - Output format: tab-separated, no headers, no alignment
 *
 * Security considerations:
 * - Password not visible in process list (via env var)
 * - SQL must be escaped for shell execution
 * - Should only be used for schema introspection queries
 *
 * @example
 * ```typescript
 * const tables = await query(
 *   "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
 * );
 * console.log(tables); // "users\nposts\ncomments"
 * ```
 */
async function query(sql: string): Promise<string> {
  const command = `psql -h ${poolConfig.host} -p ${poolConfig.port} -U ${poolConfig.user} -d ${poolConfig.database} -t -A -c "${sql.replace(/"/g, '\\"')}"`;

  try {
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: poolConfig.password,
      },
    });

    return stdout.trim();
  } catch (error) {
    console.error(`Query failed: ${sql}`);
    console.error(error);
    throw error;
  }
}

/**
 * Retrieves list of all user-defined custom types (enums)
 *
 * Queries pg_type system catalog to find all enum types defined in the
 * public schema. System types and types from other schemas are excluded.
 *
 * @returns Array of enum type names, sorted alphabetically
 *
 * @remarks
 * Query details:
 * - Joins pg_type with pg_namespace for schema filtering
 * - Filters for typtype = 'e' (enum types only)
 * - Limited to public schema (nspname = 'public')
 * - Results sorted for consistent output
 *
 * Use cases:
 * - Schema documentation
 * - Type definition dumping
 * - Migration file generation
 * - Schema comparison
 *
 * @example
 * ```typescript
 * const types = await getCustomTypes();
 * // Returns: ['user_status', 'order_status', 'payment_method']
 * ```
 */
async function getCustomTypes(): Promise<string[]> {
  const result = await query(
    "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typtype = 'e' AND n.nspname = 'public' ORDER BY t.typname",
  );

  if (!result) {
    return [];
  }

  return result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Retrieves list of all user-defined tables in the public schema
 *
 * Queries pg_tables system catalog to find all base tables in the
 * public schema, excluding system tables and tables from other schemas.
 *
 * @returns Array of table names, sorted alphabetically
 *
 * @remarks
 * Includes:
 * - Regular tables (BASE TABLE)
 * - Tables in public schema only
 *
 * Excludes:
 * - System tables (pg_catalog, information_schema)
 * - Views (use pg_views for those)
 * - Materialized views
 * - Foreign tables
 *
 * @example
 * ```typescript
 * const tables = await getTables();
 * // Returns: ['users', 'posts', 'comments', 'user_profiles']
 * ```
 */
async function getTables(): Promise<string[]> {
  const result = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );

  if (!result) {
    return [];
  }

  return result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Retrieves list of all user-defined functions in the public schema
 *
 * Queries information_schema.routines to find all functions (not procedures)
 * defined in the public schema. Useful for dumping stored procedures,
 * triggers, and custom database functions.
 *
 * @returns Array of function names, sorted alphabetically
 *
 * @remarks
 * Includes:
 * - User-defined functions
 * - Trigger functions
 * - Aggregate functions (if user-defined)
 *
 * Excludes:
 * - System functions
 * - Stored procedures (if routine_type = 'PROCEDURE')
 * - Functions from other schemas
 *
 * Limitations:
 * - Does not handle function overloading (multiple functions with same name)
 * - First matching function will be used if overloaded
 *
 * @example
 * ```typescript
 * const functions = await getFunctions();
 * // Returns: ['update_timestamp', 'calculate_balance', 'notify_change']
 * ```
 */
async function getFunctions(): Promise<string[]> {
  const result = await query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name",
  );

  if (!result) {
    return [];
  }

  return result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Dumps a custom enum type definition to a SQL file
 *
 * Extracts the complete definition of an enum type from the database
 * and writes it as a CREATE TYPE statement to a numbered SQL file.
 *
 * @param typeName - Name of the enum type to dump
 * @param index - Numeric index for file ordering (0-padded to 2 digits)
 * @returns Generated filename
 * @throws Error if type retrieval or file write fails
 *
 * @remarks
 * Output format:
 * - File: `{index}_{typeName}.sql` (e.g., "00_user_status.sql")
 * - Location: TYPES_DIR
 * - Content: CREATE TYPE statement with all enum values
 *
 * Query details:
 * - Uses pg_enum system catalog for enum values
 * - Respects enumsortorder for correct value ordering
 * - Each value properly quoted and formatted
 *
 * @example
 * ```typescript
 * await dumpCustomType('user_status', 0);
 * // Creates: db/types/00_user_status.sql
 * // Content:
 * // CREATE TYPE public.user_status AS ENUM (
 * //     'active',
 * //     'inactive',
 * //     'suspended'
 * // );
 * ```
 */
async function dumpCustomType(
  typeName: string,
  index: number,
): Promise<string> {
  const fileName = `${String(index).padStart(2, "0")}_${typeName}.sql`;
  const outputFile = path.join(TYPES_DIR, fileName);

  try {
    const result = await query(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = '${typeName}'::regtype ORDER BY enumsortorder`,
    );

    const values = result
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => `    '${v}'`)
      .join(",\n");

    const typeDef = `CREATE TYPE public.${typeName} AS ENUM (\n${values}\n);`;

    await fs.writeFile(outputFile, typeDef + "\n", "utf-8");
  } catch (error) {
    console.error(`Failed to dump type ${typeName}`);
    throw error;
  }

  return fileName;
}

/**
 * Dumps a single table's schema definition to a SQL file
 *
 * Uses pg_dump to extract the complete CREATE TABLE statement including
 * columns, constraints, indexes, and other table-level definitions.
 *
 * @param tableName - Name of the table to dump
 * @param index - Numeric index for file ordering (0-padded to 2 digits)
 * @returns Generated filename
 * @throws Error if pg_dump fails or file cannot be written
 *
 * @remarks
 * Output format:
 * - File: `{index}_{tableName}.sql` (e.g., "00_users.sql")
 * - Location: TABLES_DIR
 * - Content: Complete table definition (schema-only, no data)
 *
 * pg_dump options:
 * - --table: Specific table to dump
 * - --schema-only: No data, only structure
 * - Includes: columns, constraints, indexes, triggers
 * - Excludes: table data, ownership, ACLs
 *
 * Dependency handling:
 * - Foreign key constraints included
 * - May require proper ordering in init.sql
 * - Use init-docker.sql for dependency-aware initialization
 *
 * @example
 * ```typescript
 * await dumpTable('users', 0);
 * // Creates: db/tables/00_users.sql
 * // Content: CREATE TABLE users (...) with all constraints
 * ```
 */
async function dumpTable(tableName: string, index: number): Promise<string> {
  const fileName = `${String(index).padStart(2, "0")}_${tableName}.sql`;
  const outputFile = path.join(TABLES_DIR, fileName);

  const command = `pg_dump -h ${poolConfig.host} -p ${poolConfig.port} -U ${poolConfig.user} -d ${poolConfig.database} --table=public.${tableName} --schema-only -f "${outputFile}"`;

  try {
    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: poolConfig.password,
      },
    });
  } catch (error) {
    console.error(`Failed to dump table ${tableName}`);
    throw error;
  }

  return fileName;
}

/**
 * Dumps a single function's definition to a SQL file
 *
 * Extracts the complete CREATE FUNCTION statement using PostgreSQL's
 * pg_get_functiondef() function and writes it to a numbered SQL file.
 *
 * @param functionName - Name of the function to dump
 * @param index - Numeric index for file ordering (0-padded to 2 digits)
 * @returns Generated filename
 * @throws Error if function retrieval or file write fails
 *
 * @remarks
 * Output format:
 * - File: `{index}_{functionName}.sql` (e.g., "00_update_timestamp.sql")
 * - Location: FUNCTIONS_DIR
 * - Content: Complete CREATE FUNCTION statement
 *
 * Query details:
 * - Uses pg_get_functiondef() for complete function definition
 * - Includes parameters, return type, language, and body
 * - LIMIT 1 handles function overloading (takes first match)
 *
 * Limitations:
 * - Function overloading not fully supported
 * - If multiple functions with same name, only first is dumped
 * - Consider unique naming or manual handling for overloaded functions
 *
 * @example
 * ```typescript
 * await dumpFunction('update_timestamp', 0);
 * // Creates: db/functions/00_update_timestamp.sql
 * // Content:
 * // CREATE OR REPLACE FUNCTION public.update_timestamp()
 * // RETURNS trigger LANGUAGE plpgsql AS $$
 * // BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
 * ```
 */
async function dumpFunction(
  functionName: string,
  index: number,
): Promise<string> {
  const fileName = `${String(index).padStart(2, "0")}_${functionName}.sql`;
  const outputFile = path.join(FUNCTIONS_DIR, fileName);

  try {
    const functionDef = await query(
      `SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = '${functionName}' AND n.nspname = 'public' LIMIT 1`,
    );

    if (functionDef) {
      await fs.writeFile(outputFile, functionDef + ";\n", "utf-8");
    } else {
      console.warn(
        `   ⚠ Could not get definition for function: ${functionName}`,
      );
    }
  } catch (error) {
    console.error(`Failed to dump function ${functionName}`);
    throw error;
  }

  return fileName;
}

/**
 * Ensures a directory exists, creating it recursively if needed
 *
 * Checks if a directory exists and creates it (including parent directories)
 * if it doesn't. Safe to call multiple times on the same path.
 *
 * @param dir - Absolute path to the directory to ensure
 *
 * @remarks
 * - Uses fs.access() to check existence (no race condition)
 * - Creates parent directories automatically (recursive: true)
 * - No-op if directory already exists
 * - Throws on permission errors
 *
 * @example
 * ```typescript
 * await ensureDir('/path/to/db/tables');
 * // Creates: /path, /path/to, /path/to/db, /path/to/db/tables
 * ```
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Generates init.sql file that sources all individual schema files
 *
 * Creates a PostgreSQL initialization script that uses \i commands to
 * source all individual type, table, and function files in the correct
 * order. Useful for manual database initialization with proper ordering.
 *
 * @param customTypes - Array of enum type names
 * @param tables - Array of table names
 * @param functions - Array of function names
 *
 * @remarks
 * File structure:
 * 1. Header with generation timestamp
 * 2. Custom types section (enums must be created before tables)
 * 3. Tables section (in alphabetical order)
 * 4. Functions section (after tables for dependencies)
 *
 * Usage:
 * ```bash
 * psql -U postgres -d mydb -f db/schema/init.sql
 * ```
 *
 * Limitations:
 * - Alphabetical ordering may not respect all dependencies
 * - Foreign key constraints may require manual reordering
 * - For Docker/automated setup, use init-docker.sql instead
 *
 * @example
 * ```typescript
 * await generateInitFile(
 *   ['user_status', 'order_status'],
 *   ['users', 'orders', 'order_items'],
 *   ['update_timestamp']
 * );
 * // Creates: db/schema/init.sql with \i commands for all files
 * ```
 */
async function generateInitFile(
  customTypes: string[],
  tables: string[],
  functions: string[],
): Promise<void> {
  const lines: string[] = [
    "-- Auto-generated schema initialization file",
    "-- This file sources all individual type, table and function files",
    "-- Generated at: " + new Date().toISOString(),
    "",
  ];

  // Custom types section (must come before tables that use them)
  if (customTypes.length > 0) {
    lines.push(
      "-- ============================================================================",
    );
    lines.push("-- CUSTOM TYPES (ENUMS)");
    lines.push(
      "-- ============================================================================",
    );
    lines.push("");

    for (let i = 0; i < customTypes.length; i++) {
      const fileName = `${String(i).padStart(2, "0")}_${customTypes[i]}.sql`;
      lines.push(`\\i types/${fileName}`);
    }
    lines.push("");
  }

  // Tables section
  lines.push(
    "-- ============================================================================",
  );
  lines.push("-- TABLES");
  lines.push(
    "-- ============================================================================",
  );
  lines.push("");

  for (let i = 0; i < tables.length; i++) {
    const fileName = `${String(i).padStart(2, "0")}_${tables[i]}.sql`;
    lines.push(`\\i tables/${fileName}`);
  }

  // Functions section (after tables for potential dependencies)
  if (functions.length > 0) {
    lines.push("");
    lines.push(
      "-- ============================================================================",
    );
    lines.push("-- FUNCTIONS");
    lines.push(
      "-- ============================================================================",
    );
    lines.push("");

    for (let i = 0; i < functions.length; i++) {
      const fileName = `${String(i).padStart(2, "0")}_${functions[i]}.sql`;
      lines.push(`\\i functions/${fileName}`);
    }
  }

  const initFile = path.join(SCHEMA_DIR, "init.sql");
  await fs.writeFile(initFile, lines.join("\n") + "\n", "utf-8");
}

/**
 * Generates init-docker.sql using full schema dump with proper ordering
 *
 * Creates a single-file schema dump with all objects in dependency order,
 * ideal for Docker initialization and automated deployments where \i
 * commands are not supported.
 *
 * @throws Error if pg_dump fails
 *
 * @remarks
 * pg_dump options:
 * - --schema-only: No data, only structure
 * - --no-owner: Don't include ownership commands
 * - --no-acl: Don't include access control lists
 *
 * Advantages over init.sql:
 * - Handles all dependencies automatically
 * - Single file for easy distribution
 * - Works in environments without \i support
 * - Proper topological ordering of objects
 *
 * Use cases:
 * - Docker container initialization
 * - CI/CD pipelines
 * - Automated testing environments
 * - Production deployments
 *
 * @example
 * ```typescript
 * await generateDockerInitFile();
 * // Creates: db/schema/init-docker.sql
 *
 * // Docker usage:
 * // COPY init-docker.sql /docker-entrypoint-initdb.d/
 * ```
 */
async function generateDockerInitFile(): Promise<void> {
  const dockerInitFile = path.join(SCHEMA_DIR, "init-docker.sql");

  const command = `pg_dump -h ${poolConfig.host} -p ${poolConfig.port} -U ${poolConfig.user} -d ${poolConfig.database} --schema-only --no-owner --no-acl -f "${dockerInitFile}"`;

  try {
    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: poolConfig.password,
      },
    });

    console.log("   ✓ init-docker.sql (full schema dump with proper ordering)");
  } catch (error) {
    console.error("Failed to generate init-docker.sql");
    throw error;
  }
}

/**
 * Main schema dumping orchestrator
 *
 * Coordinates the complete schema extraction process: scanning the database,
 * creating output directories, dumping all objects to individual files,
 * and generating initialization scripts.
 *
 * @remarks
 * Process flow:
 * 1. Scan database for types, tables, and functions
 * 2. Validate connection and data presence
 * 3. Create output directory structure
 * 4. Dump each object to numbered file
 * 5. Generate initialization scripts
 * 6. Display summary and exit
 *
 * Output structure:
 * ```
 * db/
 * ├── types/
 * │   ├── 00_user_status.sql
 * │   └── 01_order_status.sql
 * ├── tables/
 * │   ├── 00_users.sql
 * │   ├── 01_posts.sql
 * │   └── ...
 * ├── functions/
 * │   └── 00_update_timestamp.sql
 * └── schema/
 *     ├── init.sql (with \i commands)
 *     └── init-docker.sql (inline version)
 * ```
 *
 * Error handling:
 * - Validates database connection
 * - Checks for tables (warns if none found)
 * - Displays connection details on failure
 * - Exits with appropriate status codes
 *
 * @example
 * ```bash
 * # Run the schema dump
 * pnpm db:dump
 *
 * # Output:
 * # 🔍 Scanning database...
 * # Found 2 custom types, 15 tables and 3 functions
 * # Dumping custom types:
 * #    ✓ 00_user_status.sql
 * # ...
 * # Schema dump completed successfully!
 * ```
 */
async function dumpSchema(): Promise<void> {
  try {
    console.log("🔍 Scanning database...\n");

    // Ensure output directory structure exists
    await rotateOutputsToBackup();

    // Scan database for all schema objects
    console.log("Fetching custom types...");
    const customTypes = await getCustomTypes();

    console.log("Fetching table list...");
    const tables = await getTables();

    console.log("Fetching function list...");
    const functions = await getFunctions();

    console.log(
      `\nFound ${customTypes.length} custom types, ${tables.length} tables and ${functions.length} functions\n`,
    );

    // Validate that database has content
    if (tables.length === 0) {
      console.warn("No tables found! Make sure the database has tables.");
      console.log("\nConnection details:");
      console.log(`   Host: ${poolConfig.host}`);
      console.log(`   Database: ${poolConfig.database}`);
      console.log(`   User: ${poolConfig.user}`);
      process.exit(1);
    }

    // Dump custom types (enums) to individual files
    if (customTypes.length > 0) {
      console.log("Dumping custom types:");
      for (let i = 0; i < customTypes.length; i++) {
        const fileName = await dumpCustomType(customTypes[i], i);
        console.log(`   ✓ ${fileName}`);
      }
    }

    // Dump tables to individual files
    console.log("\nDumping tables:");
    for (let i = 0; i < tables.length; i++) {
      const fileName = await dumpTable(tables[i], i);
      console.log(`   ✓ ${fileName}`);
    }

    // Dump functions to individual files
    if (functions.length > 0) {
      console.log("\nDumping functions:");
      for (let i = 0; i < functions.length; i++) {
        const fileName = await dumpFunction(functions[i], i);
        console.log(`   ✓ ${fileName}`);
      }
    }

    // Generate initialization files
    console.log("\nGenerating initialization files...");
    await generateInitFile(customTypes, tables, functions);
    console.log("   ✓ init.sql (with \\i references)");

    await generateDockerInitFile();
    console.log("   ✓ init-docker.sql (inline for Docker)");

    // Display summary
    console.log("\nSchema dump completed successfully!\n");
    console.log("Output structure:");
    console.log(
      `   db/types/        - ${customTypes.length} custom type files`,
    );
    console.log(`   db/tables/       - ${tables.length} table files`);
    console.log(`   db/functions/    - ${functions.length} function files`);
    console.log(`   db/schema/       - Initialization files`);

    process.exit(0);
  } catch (error) {
    console.error("\nFailed to dump schema:");
    console.error(error);
    process.exit(1);
  }
}

// Execute schema dump
dumpSchema();
