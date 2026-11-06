import type { TableInfo, TableStructure } from "../types";
import { snakeToPascal } from "../utils/naming";

/**
 * Table hierarchy builder for nested query structure organization
 *
 * This module analyzes table naming conventions to build a hierarchical tree
 * structure, enabling namespace-based organization of generated types. Tables
 * with underscore-separated names (e.g., 'user_profile', 'user_settings') are
 * organized under parent namespaces, creating a clean, navigable type structure.
 */

/**
 * Builds a hierarchical tree structure from flat table list
 *
 * Analyzes table names to identify relationships and creates a nested structure
 * where tables with common prefixes are organized under parent namespaces. This
 * enables clean TypeScript namespace organization (e.g., User.Profile, User.Settings).
 *
 * @param tables - Flat array of all database tables with their metadata
 * @returns Root-level structures representing the top of the hierarchy tree
 *
 * @remarks
 * Algorithm:
 * 1. Creates TableStructure objects for all actual database tables
 * 2. Analyzes table names for underscore-separated prefixes
 * 3. Creates intermediate namespace nodes as needed
 * 4. Connects tables to their appropriate parent in the hierarchy
 *
 * Naming convention:
 * - 'users' → root level
 * - 'user_profiles' → User.Profiles (under User namespace)
 * - 'user_profile_settings' → User.Profile.Settings (nested namespaces)
 *
 * @example
 * ```typescript
 * const tables = [
 *   { tableName: 'users', columns: [...] },
 *   { tableName: 'user_profiles', columns: [...] },
 *   { tableName: 'posts', columns: [...] }
 * ];
 * const hierarchy = buildTableHierarchy(tables);
 * // Returns:
 * // [
 * //   { tableName: 'users', children: [{ tableName: 'user_profiles', ... }] },
 * //   { tableName: 'posts', children: [] }
 * // ]
 * ```
 */
export function buildTableHierarchy(tables: TableInfo[]): TableStructure[] {
  const tableMap = new Map<string, TableStructure>();
  const roots: TableStructure[] = [];

  // First pass: create TableStructure objects for all actual database tables
  createTableStructures(tables, tableMap);

  // Second pass: analyze naming to build parent-child relationships
  buildHierarchy(tables, tableMap, roots);

  return roots;
}

/**
 * Creates TableStructure objects for all database tables
 *
 * Initializes the basic structure for each table before hierarchy relationships
 * are established. All tables start at depth 0 and with no parent/children
 * relationships - these are filled in during the hierarchy building phase.
 *
 * @param tables - Array of database tables to convert
 * @param tableMap - Map to store created structures for quick lookup
 *
 * @remarks
 * - Creates structures for actual database tables only (not namespaces)
 * - All tables initially marked as non-namespace (isNamespaceOnly: false)
 * - className generated using PascalCase conversion of table name
 * - Depth and parent relationships set in subsequent hierarchy building
 */
function createTableStructures(
  tables: TableInfo[],
  tableMap: Map<string, TableStructure>,
): void {
  for (const table of tables) {
    const structure: TableStructure = {
      tableName: table.tableName,
      className: snakeToPascal(table.tableName),
      children: [],
      depth: 0,
      isNamespaceOnly: false,
    };
    tableMap.set(table.tableName, structure);
  }
}

/**
 * Builds hierarchical relationships between tables based on naming
 *
 * Analyzes underscore-separated table names to identify parent-child
 * relationships. Tables with multiple parts (e.g., 'user_profiles') are
 * nested under their prefix parent (e.g., 'user' or 'User' namespace).
 *
 * @param tables - Array of database tables to organize
 * @param tableMap - Map of table names to their structures
 * @param roots - Array to populate with root-level structures
 *
 * @remarks
 * - Single-word tables (e.g., 'users') become root-level structures
 * - Multi-word tables (e.g., 'user_profiles') are nested appropriately
 * - Creates intermediate namespace structures for missing parent levels
 * - Handles deep nesting (e.g., 'a_b_c_d' creates a→b→c→d chain)
 */
function buildHierarchy(
  tables: TableInfo[],
  tableMap: Map<string, TableStructure>,
  roots: TableStructure[],
): void {
  for (const table of tables) {
    const parts = table.tableName.split("_");

    if (parts.length === 1) {
      // Root level table (no underscores)
      roots.push(tableMap.get(table.tableName)!);
    } else {
      // Multi-part table name - build the full parent chain
      addTableToHierarchy(table.tableName, parts, tableMap, roots);
    }
  }
}

/**
 * Adds a table to the hierarchy, creating namespace parents as needed
 *
 * Processes a multi-part table name by building the complete chain of parent
 * namespaces, creating any missing intermediate levels, and finally attaching
 * the actual table to its immediate parent.
 *
 * @param tableName - Full table name (e.g., 'user_profile_settings')
 * @param parts - Table name split by underscores (e.g., ['user', 'profile', 'settings'])
 * @param tableMap - Map of all structures for lookup and creation
 * @param roots - Root-level structures array for top-level additions
 *
 * @remarks
 * Process for 'user_profile_settings':
 * 1. Check/create 'user' namespace (depth 0)
 * 2. Check/create 'user_profile' namespace (depth 1, parent: user)
 * 3. Attach 'user_profile_settings' table (depth 2, parent: user_profile)
 *
 * Each intermediate level can be either:
 * - An actual database table (reused as parent)
 * - A namespace-only structure (created on demand)
 *
 * @example
 * ```typescript
 * // For table 'user_profile_settings':
 * // Creates: User (namespace) → Profile (namespace) → Settings (table)
 * addTableToHierarchy(
 *   'user_profile_settings',
 *   ['user', 'profile', 'settings'],
 *   tableMap,
 *   roots
 * );
 * ```
 */
function addTableToHierarchy(
  tableName: string,
  parts: string[],
  tableMap: Map<string, TableStructure>,
  roots: TableStructure[],
): void {
  let currentParentName = "";
  let currentParent: TableStructure | null = null;

  // Build the chain of parent namespaces (all parts except the last)
  for (let i = 0; i < parts.length - 1; i++) {
    currentParentName = currentParentName
      ? `${currentParentName}_${parts[i]}`
      : parts[i];

    // Check if this level exists as an actual database table
    if (tableMap.has(currentParentName)) {
      currentParent = tableMap.get(currentParentName)!;
    } else {
      // Create a namespace-only structure for this intermediate level
      currentParent = getOrCreateNamespace(
        currentParentName,
        i,
        currentParent,
        tableMap,
        roots,
      );
    }
  }

  // Attach the actual table to its immediate parent
  const actualTable = tableMap.get(tableName)!;
  actualTable.parentTable = currentParentName;
  actualTable.depth = parts.length - 1;

  if (currentParent && !hasChild(currentParent, tableName)) {
    currentParent.children.push(actualTable);
  }
}

/**
 * Gets an existing namespace or creates a new one
 *
 * Retrieves a namespace structure if it exists, or creates a new namespace-only
 * structure if needed. Namespaces are intermediate nodes in the hierarchy that
 * don't correspond to actual database tables but organize related tables.
 *
 * @param name - Full namespace name (e.g., 'user' or 'user_profile')
 * @param depth - Depth level in the hierarchy (0 for root, 1+ for nested)
 * @param parent - Parent structure to attach to, or null for root level
 * @param tableMap - Map of all structures for lookup and storage
 * @param roots - Root-level structures array for root additions
 * @returns The existing or newly created namespace structure
 *
 * @remarks
 * - Namespace structures have isNamespaceOnly: true
 * - Created namespaces use PascalCase naming for TypeScript
 * - Prevents duplicate children through hasChild check
 * - Automatically attaches to parent or roots as appropriate
 *
 * @example
 * ```typescript
 * // Creating namespace 'user' for 'user_profiles' table:
 * const userNamespace = getOrCreateNamespace(
 *   'user',
 *   0,
 *   null,
 *   tableMap,
 *   roots
 * );
 * // userNamespace.isNamespaceOnly === true
 * // userNamespace.className === 'User'
 * ```
 */
function getOrCreateNamespace(
  name: string,
  depth: number,
  parent: TableStructure | null,
  tableMap: Map<string, TableStructure>,
  roots: TableStructure[],
): TableStructure {
  if (tableMap.has(name)) {
    return tableMap.get(name)!;
  }

  // Create new namespace structure
  const namespace: TableStructure = {
    tableName: name,
    className: snakeToPascal(name),
    children: [],
    depth,
    isNamespaceOnly: true,
  };

  tableMap.set(name, namespace);

  // Attach to parent or add to roots
  if (parent) {
    if (!hasChild(parent, name)) {
      parent.children.push(namespace);
    }
  } else {
    roots.push(namespace);
  }

  return namespace;
}

/**
 * Checks if a structure already has a child with the given name
 *
 * Prevents duplicate children in the hierarchy by checking if a child
 * with the specified table name already exists.
 *
 * @param structure - Parent structure to check
 * @param childName - Table name of potential child
 * @returns true if child already exists, false otherwise
 */
function hasChild(structure: TableStructure, childName: string): boolean {
  return structure.children.some((c) => c.tableName === childName);
}

/**
 * Collects all structures recursively into a flat array
 *
 * Performs a depth-first traversal of the hierarchy tree to collect
 * all structures (both tables and namespaces) into a single flat array.
 * Useful for processing all structures regardless of nesting level.
 *
 * @param hierarchy - Root-level structures to traverse
 * @returns Flat array containing all structures in the hierarchy
 *
 * @remarks
 * - Uses recursive depth-first traversal
 * - Includes both namespace-only and actual table structures
 * - Order is determined by traversal order (parent before children)
 *
 * @example
 * ```typescript
 * const allStructures = collectAllStructures(hierarchy);
 * console.log(`Total structures: ${allStructures.length}`);
 * // Includes: root tables, namespaces, and all nested tables
 * ```
 */
export function collectAllStructures(
  hierarchy: TableStructure[],
): TableStructure[] {
  const all: TableStructure[] = [];

  function collect(structure: TableStructure) {
    all.push(structure);
    structure.children.forEach(collect);
  }

  hierarchy.forEach(collect);
  return all;
}

/**
 * Filters hierarchy to only root-level structures
 *
 * Returns structures at depth 0 (top level of the hierarchy), which
 * corresponds to single-word table names or top-level namespaces.
 *
 * @param hierarchy - Complete hierarchy to filter
 * @returns Array of only root-level (depth 0) structures
 *
 * @example
 * ```typescript
 * const roots = getRootStructures(hierarchy);
 * // ['users', 'posts', 'comments'] - single-word tables
 * // Plus any top-level namespaces like 'user' for 'user_profiles'
 * ```
 */
export function getRootStructures(
  hierarchy: TableStructure[],
): TableStructure[] {
  return hierarchy.filter((t) => t.depth === 0);
}

/**
 * Filters hierarchy to only actual database tables (excluding namespaces)
 *
 * Returns structures that correspond to actual database tables, filtering
 * out any namespace-only structures that were created for organization.
 *
 * @param hierarchy - Complete hierarchy to filter
 * @returns Array of only actual table structures (isNamespaceOnly: false)
 *
 * @remarks
 * - Collects from entire hierarchy tree (not just roots)
 * - Useful when you need to process only real database tables
 * - Excludes organizational namespaces that don't have table data
 *
 * @example
 * ```typescript
 * const tables = getActualTables(hierarchy);
 * // Only includes structures for actual database tables
 * // Excludes intermediate namespace nodes like 'user' if no 'user' table exists
 * ```
 */
export function getActualTables(hierarchy: TableStructure[]): TableStructure[] {
  return collectAllStructures(hierarchy).filter((s) => !s.isNamespaceOnly);
}
