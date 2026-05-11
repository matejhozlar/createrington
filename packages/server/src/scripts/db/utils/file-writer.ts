import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/**
 * Safe file writing utilities with automatic directory creation
 *
 * This module provides robust file system operations that handle common edge cases
 * like missing directories, ensuring that file writes succeed even when the target
 * directory structure doesn't exist yet. Particularly useful for code generation
 * workflows where output directories may not be present initially.
 */

/**
 * Ensures a directory exists, creating it recursively if needed
 *
 * Creates the entire directory path including any missing parent directories.
 * Safe to call even if the directory already exists (no-op in that case).
 *
 * @param dirPath - Absolute or relative path to the directory to ensure
 *
 * @example
 * ```typescript
 * ensureDirectory('./generated/types/models');
 * // Creates the entire path if any part doesn't exist
 * ```
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writes content to a file with automatic directory creation
 *
 * Ensures the parent directory exists before writing, preventing ENOENT errors.
 * Overwrites the file if it already exists. Always writes with UTF-8 encoding.
 *
 * @param filePath - Absolute or relative path where the file should be written
 * @param content - String content to write to the file
 *
 * @example
 * ```typescript
 * writeFile('./generated/types/User.ts', 'export interface User { ... }');
 * // Creates ./generated/types/ if needed, then writes the file
 * ```
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDirectory(dir);
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Writes a file only if it doesn't already exist (safe scaffolding)
 *
 * Used for creating scaffold/template files that should not overwrite existing
 * user modifications. Ideal for initial file generation where you want to create
 * a starting point but preserve any changes the user has made.
 *
 * @param filePath - Absolute or relative path where the file should be written
 * @param content - String content to write to the file
 * @returns `true` if the file was created, `false` if it already existed
 *
 * @example
 * ```typescript
 * const created = writeFileIfNotExists(
 *   './queries/userQueries.ts',
 *   '// Add your queries here'
 * );
 * if (created) {
 *   console.log('Created new query scaffold');
 * } else {
 *   console.log('Query file already exists, skipping');
 * }
 * ```
 */
export function writeFileIfNotExists(
  filePath: string,
  content: string,
): boolean {
  if (fs.existsSync(filePath)) {
    return false;
  }

  writeFile(filePath, content);
  return true;
}

/**
 * Copies a file with automatic directory creation at the destination
 *
 * Ensures the destination directory exists before copying, preventing ENOENT errors.
 * Overwrites the destination file if it already exists.
 *
 * @param source - Path to the source file to copy
 * @param destination - Path where the file should be copied to
 *
 * @throws Will throw if the source file doesn't exist or isn't readable
 *
 * @example
 * ```typescript
 * copyFile(
 *   './templates/base-query.ts',
 *   './generated/queries/userQueries.ts'
 * );
 * // Creates ./generated/queries/ if needed, then copies the template
 * ```
 */
export function copyFile(source: string, destination: string): void {
  const dir = path.dirname(destination);
  ensureDirectory(dir);
  fs.copyFileSync(source, destination);
}

/**
 * Calculates the relative path from one directory to another
 *
 * Useful for generating correct import statements in generated code, ensuring
 * that imports work correctly regardless of the file's location in the project.
 *
 * @param from - The starting directory path (typically the file doing the importing)
 * @param to - The target path (typically the file being imported)
 * @returns A relative path string that navigates from `from` to `to`
 *
 * @example
 * ```typescript
 * const importPath = getRelativePath(
 *   '/project/src/queries',
 *   '/project/src/types/User.ts'
 * );
 * // Returns: '../types/User.ts'
 *
 * // Can be used in import generation:
 * const importStatement = `import { User } from '${importPath}';`;
 * ```
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Deletes a directory and all its contents, then recreates it empty
 *
 * Used for clean regeneration: ensures no stale files from previous
 * generation runs remain in the output directory.
 *
 * @param dirPath - Absolute path to the directory to clean
 */
export async function cleanDirectory(dirPath: string): Promise<void> {
  if (fs.existsSync(dirPath)) {
    await fsp.rm(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}
