import "@/logger.global";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Database type generation orchestrator
 *
 * This is the main entry point for the database type generation system. It
 * coordinates the complete process of reading SQL files from the db/ directory,
 * building hierarchical structures, and generating comprehensive TypeScript
 * types and query classes across multiple packages in a monorepo structure.
 *
 * Each run performs a clean generation — output directories are wiped and
 * fully regenerated from the current database schema.
 */

// Types
import type {
  EnumTypeInfo,
  GenerationContext,
  GenerationResult,
  TableStructure,
} from "./types";

// Schema operations
import { readSchemaFromSqlFiles } from "./schema/sql-parser";

// Hierarchy
import { buildTableHierarchy, collectAllStructures } from "./hierarchy/builder";

// Generators
import { generateTypes } from "./generators/types";
import { generateBaseTypes } from "./generators/base-types";
import { generateConstants } from "./generators/constants";
import { generateBaseQueries } from "./generators/base-queries";
import { generateNamespaceQueries } from "./generators/namespace-queries";
import { generateActualQueries } from "./generators/actual-queries";
import { generateDatabaseQueries } from "./generators/database-queries";
import { generateQueryHelpers } from "./generators/query-helpers";
import {
  generateBarrelExport,
  generateActualQueriesBarrel,
  generateSharedBarrelExport,
} from "./generators/barrel-exports";

// File operations
import {
  writeFile,
  writeFileIfNotExists,
  copyFile,
  getRelativePath,
  cleanDirectory,
} from "./utils/file-writer";
import { generateEnumTypes } from "./generators/enum-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sets up generation context with all required paths
 *
 * Calculates and returns all directory paths needed for the generation process,
 * including monorepo structure navigation, shared package locations, and output
 * directories for different types of generated files.
 *
 * @returns Complete generation context with all paths resolved
 *
 * @remarks
 * Directory structure:
 * ```
 * monorepo/
 * ├── shared/                     (sharedPackageRoot)
 * │   └── src/db/                (sharedTypesDir) - TypeScript types
 * └── server/                     (projectRoot)
 *     └── src/
 *         ├── generated/db/      (generatedDir) - Base query classes
 *         └── db/queries/        (actualQueriesDir) - User query classes
 * ```
 *
 * Path purposes:
 * - projectRoot: Current package being generated for
 * - monorepoRoot: Top-level monorepo directory
 * - sharedPackageRoot: Shared package for cross-package types
 * - sharedTypesDir: Where TypeScript types are written (shared)
 * - generatedDir: Where base queries are written (current package)
 * - actualQueriesDir: Where user query classes are scaffolded
 *
 * @example
 * ```typescript
 * const context = setupContext();
 * console.log(context.generatedDir);
 * // "/path/to/monorepo/server/src/generated/db"
 * ```
 */
function setupContext(): GenerationContext {
  const projectRoot = path.resolve(__dirname, "../../..");
  const monorepoRoot = path.resolve(projectRoot, "..");
  const sharedPackageRoot = path.resolve(monorepoRoot, "shared");
  const sharedTypesDir = path.resolve(sharedPackageRoot, "src/db");
  const generatedDir = path.resolve(projectRoot, "src/generated/db");
  const actualQueriesDir = path.resolve(projectRoot, "src/db/queries");

  return {
    projectRoot,
    monorepoRoot,
    sharedPackageRoot,
    sharedTypesDir,
    generatedDir,
    actualQueriesDir,
  };
}

/**
 * Generates all files for a single table structure (recursively)
 *
 * Processes a table structure and all its children, generating the appropriate
 * files based on whether the structure represents an actual database table or
 * just an organizational namespace. Handles both generation of auto-generated
 * files and scaffolding of user-editable files.
 *
 * @param structure - Table or namespace structure to process
 * @param tableMap - Map of table names to their metadata for quick lookup
 * @param context - Generation context with all directory paths
 * @param generatedFiles - Accumulator for tracking generated files (mutated)
 * @param scaffoldedFiles - Accumulator for tracking scaffolded files (mutated)
 *
 * @remarks
 * For actual database tables (isNamespaceOnly: false):
 * 1. Generates TypeScript types in shared package
 * 2. Generates base query class in generated directory
 * 3. Scaffolds user query class (once, never overwritten)
 *
 * For namespace structures (isNamespaceOnly: true):
 * 1. Generates namespace query class in generated directory
 * 2. Copies to actual directory (overwrites intentionally)
 *
 * File organization:
 * - Types: shared/src/db/{table_name}.types.ts
 * - Base queries: src/generated/db/{table_name}.queries.ts
 * - User queries: src/db/queries/{table}/{name}/index.ts
 * - Namespaces: Both generated and actual directories
 *
 * Recursive behavior:
 * - Processes all children after processing current structure
 * - Maintains hierarchical file organization
 * - Builds complete tree from root to leaves
 *
 * @example
 * ```typescript
 * // For table 'user_profiles' (actual table):
 * generateTableFiles(structure, tableMap, context, generated, scaffolded);
 * // Creates:
 * // - shared/src/db/user_profiles.types.ts (types)
 * // - src/generated/db/user_profiles.queries.ts (base)
 * // - src/db/queries/user/profiles/index.ts (scaffold, once)
 *
 * // For 'admin_log' (namespace only):
 * generateTableFiles(structure, tableMap, context, generated, scaffolded);
 * // Creates:
 * // - src/generated/db/admin_log.queries.ts (namespace)
 * // - src/db/queries/admin/log/index.ts (namespace, copied)
 * ```
 */
const NAMESPACE_MARKER = "This is a pure organizational namespace";

function canOverwriteWithNamespace(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, "utf-8");
  return content.includes(NAMESPACE_MARKER);
}

function generateTableFiles(
  structure: TableStructure,
  tableMap: Map<string, any>,
  context: GenerationContext,
  generatedFiles: string[],
  scaffoldedFiles: string[],
  enums: EnumTypeInfo[],
): void {
  const { projectRoot, sharedTypesDir, generatedDir, actualQueriesDir } =
    context;
  const parts = structure.tableName.split("_");
  const actualDir = path.join(actualQueriesDir, ...parts);

  if (!structure.isNamespaceOnly) {
    // ACTUAL DATABASE TABLE
    const table = tableMap.get(structure.tableName)!;

    // 1. Generate TypeScript types in SHARED package (cross-package reuse)
    const typesContent = generateTypes(table, enums);
    const typesFile = path.join(
      sharedTypesDir,
      `${structure.tableName}.types.ts`,
    );
    writeFile(typesFile, typesContent);
    generatedFiles.push(getRelativePath(projectRoot, typesFile));

    // 2. Generate base query class in SERVER (auto-generated CRUD)
    const baseQueryContent = generateBaseQueries(table, structure);
    const baseQueryFile = path.join(
      generatedDir,
      `${structure.tableName}.queries.ts`,
    );
    writeFile(baseQueryFile, baseQueryContent);
    generatedFiles.push(getRelativePath(projectRoot, baseQueryFile));

    // 3. Scaffold actual query class if doesn't exist (NEVER overwrite user code)
    const actualQueryFile = path.join(actualDir, "index.ts");
    const wasScaffolded = writeFileIfNotExists(
      actualQueryFile,
      generateActualQueries(structure),
    );
    if (wasScaffolded) {
      scaffoldedFiles.push(getRelativePath(projectRoot, actualQueryFile));
    }
  } else {
    // NAMESPACE ONLY (organizational structure, no database table)
    const namespaceContent = generateNamespaceQueries(structure);
    const namespaceFile = path.join(
      generatedDir,
      `${structure.tableName}.queries.ts`,
    );
    writeFile(namespaceFile, namespaceContent);
    generatedFiles.push(getRelativePath(projectRoot, namespaceFile));

    // Copy to actual directory, but only if the existing file is also a
    // generated namespace file (or doesn't exist). Never overwrite user-
    // scaffolded query files — when a table is temporarily deleted, its
    // node becomes namespace-only and would otherwise destroy the scaffold.
    const actualNamespaceFile = path.join(actualDir, "index.ts");
    if (canOverwriteWithNamespace(actualNamespaceFile)) {
      copyFile(namespaceFile, actualNamespaceFile);
    }
  }

  // Recursively process all children to build complete hierarchy
  for (const child of structure.children) {
    generateTableFiles(
      child,
      tableMap,
      context,
      generatedFiles,
      scaffoldedFiles,
      enums,
    );
  }
}

/**
 * Main generation function — performs a clean generation from the current database schema
 *
 * Wipes output directories (`shared/src/db/` and `server/src/generated/db/`), then
 * introspects the database and regenerates all TypeScript types and query classes.
 *
 * @returns Generation result with statistics and file lists
 */
export async function generate(): Promise<GenerationResult> {
  console.log("[generate] Reading schema from SQL files...");

  // Setup all directory paths for monorepo structure
  const context = setupContext();

  // Clean output directories for a fresh generation
  console.log("[generate] Cleaning output directories...");
  await cleanDirectory(context.sharedTypesDir);
  await cleanDirectory(context.generatedDir);

  // Read complete schema from SQL files in db/
  const dbDir = path.resolve(context.monorepoRoot, "..", "db");
  const schema = readSchemaFromSqlFiles(dbDir);
  const { tables, enums } = schema;

  console.log(
    `[generate] Found ${tables.length} tables and ${enums.length} enum types`,
  );

  // Build hierarchical structure from table naming conventions
  const hierarchy = buildTableHierarchy(tables);
  console.log(`[generate] Built hierarchy with ${hierarchy.length} root nodes`);

  // Track all generated and scaffolded files
  const generatedFiles: string[] = [];
  const scaffoldedFiles: string[] = [];
  const tableMap = new Map(tables.map((t) => [t.tableName, t]));

  // Generate files for each table in the hierarchy
  for (const root of hierarchy) {
    generateTableFiles(
      root,
      tableMap,
      context,
      generatedFiles,
      scaffoldedFiles,
      enums,
    );
  }

  // Generate shared files (constants, helpers, barrel exports)
  generateSharedFiles(tables, enums, hierarchy, context, generatedFiles);

  return {
    files: generatedFiles,
    scaffolds: scaffoldedFiles,
    tablesFound: tables.length,
  };
}

/**
 * Generates shared utility files used across the entire system
 *
 * Creates files that don't belong to specific tables but are needed for the
 * overall query system to function: base types, constants, helpers, and
 * barrel exports that tie everything together.
 *
 * @param tables - Array of all database tables with metadata
 * @param hierarchy - Complete table hierarchy structure
 * @param context - Generation context with directory paths
 * @param generatedFiles - Accumulator for tracking generated files (mutated)
 *
 * @remarks
 * Generated shared files:
 *
 * 1. **base.types.ts** (shared package)
 *    - FilterValue and FilterOperators types
 *    - Foundation for all table filter types
 *    - Location: shared/src/db/base.types.ts
 *
 * 2. **index.ts** (shared package)
 *    - Barrel export for all shared types
 *    - Single import point for types across monorepo
 *    - Location: shared/src/db/index.ts
 *
 * 3. **index.ts** (generated directory)
 *    - Main barrel export for server-side code
 *    - Re-exports types, queries, constants, helpers
 *    - Location: src/generated/db/index.ts
 *
 * 4. **queries.ts** (generated directory)
 *    - QueryInstances interface and factory functions
 *    - createQueryInstances() and createQueries()
 *    - Location: src/generated/db/queries.ts
 *
 * 5. **db.ts** (generated directory)
 *    - DatabaseQueries class with transaction support
 *    - Main entry point for database operations
 *    - Location: src/generated/db/db.ts
 *
 * 6. **constants.ts** (generated directory)
 *    - DatabaseTable constant with all table/field names
 *    - Type-safe table and field name access
 *    - Location: src/generated/db/constants.ts
 *
 * 7. **index.ts** (queries directory)
 *    - Barrel export for user query classes
 *    - Single import point for custom queries
 *    - Location: src/db/queries/index.ts
 *
 * File organization principles:
 * - Shared package: Types only (no runtime dependencies)
 * - Generated directory: Auto-generated code (never edit)
 * - Queries directory: User code (edit freely)
 *
 * @example
 * ```typescript
 * generateSharedFiles(tables, hierarchy, context, generatedFiles);
 * // Creates all shared utility files
 * // Updates generatedFiles accumulator with paths
 * ```
 */
function generateSharedFiles(
  tables: any[],
  enums: EnumTypeInfo[],
  hierarchy: TableStructure[],
  context: GenerationContext,
  generatedFiles: string[],
): void {
  const { projectRoot, sharedTypesDir, generatedDir, actualQueriesDir } =
    context;

  // Generate database enum types
  const enumTypesFile = path.join(sharedTypesDir, "database.types.ts");
  writeFile(enumTypesFile, generateEnumTypes(enums));
  generatedFiles.push(getRelativePath(projectRoot, enumTypesFile));

  // Base types file for shared/db (FilterValue, FilterOperators)
  const baseTypesFile = path.join(sharedTypesDir, "base.types.ts");
  writeFile(baseTypesFile, generateBaseTypes());
  generatedFiles.push(getRelativePath(projectRoot, baseTypesFile));

  // Barrel export for shared/db (types only, cross-package)
  const sharedBarrelFile = path.join(sharedTypesDir, "index.ts");
  writeFile(sharedBarrelFile, generateSharedBarrelExport(tables));
  generatedFiles.push(getRelativePath(projectRoot, sharedBarrelFile));

  // Barrel export for generated/db (main server entry point)
  const barrelFile = path.join(generatedDir, "index.ts");
  writeFile(barrelFile, generateBarrelExport(tables));
  generatedFiles.push(getRelativePath(projectRoot, barrelFile));

  // Query helpers (factory functions and types)
  const queryHelpersFile = path.join(generatedDir, "queries.ts");
  writeFile(queryHelpersFile, generateQueryHelpers(hierarchy));
  generatedFiles.push(getRelativePath(projectRoot, queryHelpersFile));

  // DatabaseQueries class (transaction support and query access)
  const dbQueriesFile = path.join(generatedDir, "db.ts");
  writeFile(dbQueriesFile, generateDatabaseQueries(hierarchy));
  generatedFiles.push(getRelativePath(projectRoot, dbQueriesFile));

  // Constants (type-safe table and field name access)
  const constantsFile = path.join(generatedDir, "constants.ts");
  writeFile(constantsFile, generateConstants(tables));
  generatedFiles.push(getRelativePath(projectRoot, constantsFile));

  // Actual queries barrel (user query class exports)
  const actualQueriesBarrelFile = path.join(actualQueriesDir, "index.ts");
  writeFile(actualQueriesBarrelFile, generateActualQueriesBarrel(hierarchy));
  generatedFiles.push(getRelativePath(projectRoot, actualQueriesBarrelFile));
}

/**
 * CLI entry point - exports main generation function
 *
 * Allows this module to be imported as a library or executed directly
 * as a CLI tool with formatted output and error handling.
 */
export default generate;

/**
 * Auto-execute when run directly (not imported)
 *
 * Detects if this file is being executed directly (vs imported) and
 * runs the generation process with CLI-friendly output formatting,
 * progress indicators, and proper error handling.
 *
 * @remarks
 * CLI output format:
 * - Progress indicators during generation
 * - Summary statistics on completion
 * - List of scaffolded files for user action
 * - Error messages on failure
 * - Proper exit codes (0 success, 1 error)
 *
 * Exit codes:
 * - 0: Generation completed successfully
 * - 1: Error occurred during generation
 *
 * @example
 * ```bash
 * # Run directly
 * npm run generate
 *
 * # Output:
 * # 📡 Connecting to database...
 * # ✅ Found 25 tables
 * # Built hierarchy with 8 root nodes
 * #
 * # ✅ Generated 127 files
 * # 📝 Scaffolded 3 new query files
 * # 📊 Total tables: 25
 * # 🔄 Schema changes: 5
 * #
 * # 📂 Scaffolded files (edit these in src/db/queries/):
 * #    - src/db/queries/user/profiles/index.ts
 * #    - src/db/queries/admin/log/actions/index.ts
 * #    - src/db/queries/player/balance/index.ts
 * ```
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  generate()
    .then((result) => {
      console.log(`[generate] Generated ${result.files.length} files`);
      console.log(`[generate] Scaffolded ${result.scaffolds.length} new query files`);
      console.log(`[generate] Total tables: ${result.tablesFound}`);

      if (result.scaffolds.length > 0) {
        console.log("[generate] Scaffolded files (edit these in src/db/queries/):");
        result.scaffolds.forEach((file) => console.log(`[generate]   - ${file}`));
      }
    })
    .catch((error) => {
      console.error("[generate] Error:", error.message);
      console.error(error);
      process.exit(1);
    });
}
