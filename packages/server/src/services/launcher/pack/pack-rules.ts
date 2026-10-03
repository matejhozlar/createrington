import type {
  LauncherPackData,
  LauncherPackFileSource,
  LauncherPackFolder,
} from "@createrington/shared/launcher";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CLASS_FOLDERS: Record<number, LauncherPackFolder> = {
  [CURSEFORGE_CLASSES.mods]: "mods",
  [CURSEFORGE_CLASSES.resourcePacks]: "resourcepacks",
  [CURSEFORGE_CLASSES.shaders]: "shaderpacks",
};

export function packFolderForClass(classId: number): LauncherPackFolder | null {
  return CLASS_FOLDERS[classId] ?? null;
}

export function pickFileSource(
  curseforgeUrl: string | null,
  modrinthUrl: string | null,
  storageUrl: string | null,
): { source: LauncherPackFileSource; downloadUrl: string | null } {
  if (curseforgeUrl)
    return { source: "curseforge", downloadUrl: curseforgeUrl };
  if (modrinthUrl) return { source: "modrinth", downloadUrl: modrinthUrl };
  if (storageUrl) return { source: "storage", downloadUrl: storageUrl };
  return { source: "manual", downloadUrl: null };
}

export function parseModLoader(
  loaderId: string,
): LauncherPackData["modLoader"] | null {
  const separator = loaderId.indexOf("-");
  if (separator <= 0 || separator === loaderId.length - 1) return null;
  return {
    id: loaderId,
    name: loaderId.slice(0, separator).toLowerCase(),
    version: loaderId.slice(separator + 1),
  };
}

export function curseforgeFilePageUrl(
  projectWebsiteUrl: string | null,
  fileId: number,
): string | null {
  if (!projectWebsiteUrl) return null;
  return `${projectWebsiteUrl.replace(/\/+$/, "")}/files/${fileId}`;
}
