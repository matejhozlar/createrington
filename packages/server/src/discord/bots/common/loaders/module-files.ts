import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function collectModuleFiles(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectModuleFiles(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function importDefaultExport(filePath: string): Promise<unknown> {
  const loaded = (await import(pathToFileURL(filePath).href)) as {
    default?: unknown;
  };
  return loaded.default;
}
