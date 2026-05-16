import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distDir = path.join(__dirname, "..", "..", "..", "dist");

/**
 * Normalize separators to forward slashes for import statements
 */
function normalizeImportPath(importPath: string): string {
  return importPath.replace(/\\/g, "/");
}

/**
 * Check if a path points to a directory with an index.js file
 */
function hasIndexFile(basePath: string, importPath: string): boolean {
  const fullPath = path.join(basePath, importPath);
  const indexPath = path.join(fullPath, "index.js");
  return fs.existsSync(indexPath);
}

/**
 * Check if a file exists with .js extension
 */
function fileExists(basePath: string, importPath: string): boolean {
  const fullPath = path.join(basePath, importPath + ".js");
  return fs.existsSync(fullPath);
}

/**
 * Resolve @/ alias to relative path
 */
function resolveAlias(fileDir: string, importPath: string): string {
  if (importPath.startsWith("@/")) {
    const pathWithoutAlias = importPath.slice(2);
    const targetPath = path.join(distDir, pathWithoutAlias);
    const relativePath = path.relative(fileDir, targetPath);

    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  }

  return importPath;
}

function processImport(
  importPath: string,
  fileDir: string,
  distDir: string,
): string {
  if (importPath.endsWith(".js") || importPath.endsWith(".json")) {
    return importPath;
  }

  if (!importPath.startsWith(".") && !importPath.startsWith("@/")) {
    return importPath;
  }

  const resolvedImport = resolveAlias(fileDir, importPath);

  const resolvedBase = path.resolve(fileDir, resolvedImport);
  const relativeToBase = path.relative(distDir, resolvedBase);

  const normalizedImport = normalizeImportPath(resolvedImport);

  if (hasIndexFile(distDir, relativeToBase)) {
    return `${normalizedImport}/index.js`;
  }

  if (fileExists(distDir, relativeToBase)) {
    return `${normalizedImport}.js`;
  }

  console.warn(
    `Could not resolve: ${importPath} in ${path.relative(distDir, fileDir)}`,
  );
  return `${normalizedImport}.js`;
}

function fixImports(dir: string): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith(".js")) {
      let content = fs.readFileSync(filePath, "utf-8");
      const fileDir = path.dirname(filePath);

      content = content.replace(
        /(from|import)\s+['"]([^'"]+)['"];?/gm,
        (match: string, keyword: string, importPath: string): string => {
          const fixedPath = processImport(importPath, fileDir, distDir);
          return `${keyword} '${fixedPath}';`;
        },
      );

      // Dynamic imports whose argument is a quoted string literal.
      // Template strings and non-literal arguments are intentionally left alone.
      content = content.replace(
        /\bimport\(\s*(['"])([^'"`]+)\1\s*\)/g,
        (_match: string, quote: string, importPath: string): string => {
          const fixedPath = processImport(importPath, fileDir, distDir);
          return `import(${quote}${fixedPath}${quote})`;
        },
      );

      fs.writeFileSync(filePath, content, "utf-8");
    }
  }
}

console.log("Finalizing build...");
fixImports(distDir);
console.log("Build done!");
