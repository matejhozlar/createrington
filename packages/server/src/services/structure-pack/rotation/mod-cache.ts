import path from "node:path";
import fs from "node:fs/promises";
import { downloadModFile as cfDownload } from "@/services/curseforge";
import { getLocalPath } from "@/services/mc-server/file-ops";
import type { StructurePackMod } from "@createrington/shared/db";
import { CACHE_DIR } from "./constants";

/**
 * Returns the absolute path to the mod file cache directory.
 *
 * Uses the configured local server path when available; falls back to a
 * `.structure-pack-cache` folder in the process working directory for SFTP mode.
 */
export function getCacheDir(): string {
  const localPath = getLocalPath();
  if (localPath) {
    return path.join(localPath, CACHE_DIR);
  }
  // Fallback to temp dir for SFTP mode
  return path.join(process.cwd(), ".structure-pack-cache");
}

/**
 * Returns the full path to a specific mod file within the cache directory.
 *
 * @param fileName - The mod's filename (e.g. `structurized-1.20.jar`)
 * @returns Absolute path to the cached file
 */
export function getCachePath(fileName: string): string {
  return path.join(getCacheDir(), fileName);
}

/**
 * Downloads any mods not already present in the local cache.
 *
 * Creates the cache directory if it does not exist, then iterates the provided
 * mod list, skipping files that are already cached and downloading the rest
 * from CurseForge.
 *
 * @param mods - List of mods to ensure are cached
 * @returns Promise that resolves when all mods are available in the cache
 */
export async function ensureModsCached(
  mods: StructurePackMod[],
): Promise<void> {
  const cacheDir = getCacheDir();
  await fs.mkdir(cacheDir, { recursive: true });

  for (const mod of mods) {
    const cachePath = getCachePath(mod.fileName);
    try {
      await fs.access(cachePath);
      logger.info(`Mod already cached: ${mod.fileName}`);
    } catch {
      logger.info(
        `Downloading mod: ${mod.modName} (${mod.curseforgeModId}/${mod.curseforgeFileId})`,
      );
      await cfDownload(
        mod.curseforgeModId,
        mod.curseforgeFileId,
        cacheDir,
        mod.fileName,
      );
      logger.info(`Downloaded: ${mod.fileName}`);
    }
  }
}
