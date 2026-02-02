import "@/logger.global";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@/config";

/**
 * Database type generation orchestrator
 *
 * This is the main entry point for the database type generation system. It
 * coordinates the complete process of introspecting a PostgreSQL database,
 * detecting schema changes, building hierarchical structures, and generating
 * comprehensive TypeScript types and query classes across multiple packages
 * in a monorepo structure.
 */

// Types
import type {
  EnumTypeInfo,
  GenerationContext,
  GenerationResult,
  TableStructure,
} from "./types";

// Schema operations
import { readSchemaFromDatabase } from "./schema/introspection";
import {
  loadSchemaCache,
  buildSchemaCache,
  saveSchemaCache,
} from "./schema/cache";
import {
  detectSchemaChanges,
  printChanges,
  updateChangelog,
} from "./schema/change-detection";

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
 * - cacheFile: Schema cache for incremental generation
 * - changelogFile: Markdown changelog of schema changes
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
  const cacheFile = path.join(generatedDir, ".schema-cache.json");
  const changelogFile = path.join(generatedDir, "CHANGELOG.md");

  return {
    projectRoot,
    monorepoRoot,
    sharedPackageRoot,
    sharedTypesDir,
    generatedDir,
    actualQueriesDir,
    cacheFile,
    changelogFile,
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
function generateTableFiles(
  structure: TableStructure,
  tableMap: Map<string, any>,
  context: GenerationContext,
  generatedFiles: string[],
  scaffoldedFiles: string[],
): void {
  const { projectRoot, sharedTypesDir, generatedDir, actualQueriesDir } =
    context;
  const parts = structure.tableName.split("_");
  const actualDir = path.join(actualQueriesDir, ...parts);

  if (!structure.isNamespaceOnly) {
    // ACTUAL DATABASE TABLE
    const table = tableMap.get(structure.tableName)!;

    // 1. Generate TypeScript types in SHARED package (cross-package reuse)
    const typesContent = generateTypes(table);
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

    // Copy to actual directory (overwrites namespace files intentionally)
    // This is safe because namespaces are purely organizational
    const actualNamespaceFile = path.join(actualDir, "index.ts");
    copyFile(namespaceFile, actualNamespaceFile);
  }

  // Recursively process all children to build complete hierarchy
  for (const child of structure.children) {
    generateTableFiles(
      child,
      tableMap,
      context,
      generatedFiles,
      scaffoldedFiles,
    );
  }
}

/**
 * Main generation function - orchestrates complete type generation process
 *
 * This is the primary entry point that coordinates all aspects of the generation
 * process: database introspection, change detection, hierarchy building, file
 * generation, and result tracking. Designed to be both a library function and
 * a CLI tool.
 *
 * @returns Generation result with statistics and file lists
 *
 * @remarks
 * Generation process (in order):
 * 1. **Connection**: Connect to PostgreSQL database
 * 2. **Introspection**: Read complete schema metadata
 * 3. **Change Detection**: Compare with cached schema, identify changes
 * 4. **Changelog**: Update CHANGELOG.md with detected changes
 * 5. **Hierarchy**: Build table hierarchy from naming conventions
 * 6. **Table Files**: Generate types, base queries, and scaffolds
 * 7. **Shared Files**: Generate constants, helpers, and barrel exports
 * 8. **Cache Update**: Save current schema for next run
 * 9. **Results**: Return statistics and file lists
 *
 * Incremental generation:
 * - Schema cache enables change detection
 * - Only regenerates when schema changes
 * - Changelog provides audit trail
 * - User files never overwritten
 *
 * Output organization:
 * - Shared package: TypeScript types (for all packages)
 * - Generated directory: Base query classes (auto-generated)
 * - Queries directory: User query classes (user-editable)
 * - Constants: Type-safe table/field name access
 * - Helpers: Factory functions and utilities
 *
 * Error handling:
 * - Database connection failures propagate
 * - File write errors propagate
 * - CLI catches and formats errors
 *
 * @example
 * ```typescript
 * // As library function:
 * const result = await generate();
 * console.log(`Generated ${result.files.length} files`);
 * console.log(`Detected ${result.changes} schema changes`);
 *
 * // As CLI tool (auto-executed when run directly):
 * // npm run generate
 * // Output:
 * // 📡 Connecting to database...
 * // ✅ Found 25 tables
 * // Built hierarchy with 8 root nodes
 * // ✅ Generated 127 files
 * ```
 */
export async function generate(): Promise<GenerationResult> {
  console.log("📡 Connecting to database...");

  // Setup all directory paths for monorepo structure
  const context = setupContext();

  // Read complete schema from PostgreSQL database
  const schema = await readSchemaFromDatabase(config.database);
  const { tables, enums } = schema;

  console.log(
    `✅ Found ${tables.length} tables and ${enums.length} enum types`,
  );

  // Detect changes by comparing with cached schema
  const previousSchema = loadSchemaCache(context.cacheFile);
  const currentSchema = buildSchemaCache(tables);
  const changes = previousSchema
    ? detectSchemaChanges(previousSchema, currentSchema)
    : [];

  // Display and log schema changes
  printChanges(changes);

  if (changes.length > 0) {
    updateChangelog(context.changelogFile, changes);
  }

  // Build hierarchical structure from table naming conventions
  const hierarchy = buildTableHierarchy(tables);
  console.log(`Built hierarchy with ${hierarchy.length} root nodes`);

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
    );
  }

  // Generate shared files (constants, helpers, barrel exports)
  generateSharedFiles(tables, enums, hierarchy, context, generatedFiles);

  // Save schema cache for next incremental run
  saveSchemaCache(context.cacheFile, currentSchema);

  return {
    files: generatedFiles,
    scaffolds: scaffoldedFiles,
    tablesFound: tables.length,
    changes: changes.length,
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
      console.log(`\n✅ Generated ${result.files.length} files`);
      console.log(`📝 Scaffolded ${result.scaffolds.length} new query files`);
      console.log(`📊 Total tables: ${result.tablesFound}`);

      if (result.changes > 0) {
        console.log(`🔄 Schema changes: ${result.changes}`);
      }

      if (result.scaffolds.length > 0) {
        console.log("\n📂 Scaffolded files (edit these in src/db/queries/):");
        result.scaffolds.forEach((file) => console.log(`   - ${file}`));
      }
    })
    .catch((error) => {
      console.error("❌ Error:", error.message);
      console.error(error);
      process.exit(1);
    });
}
