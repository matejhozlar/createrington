import type {
  LauncherPackData,
  LauncherPackFileSource,
  LauncherPackFolder,
} from "@createrington/shared/launcher";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CURSEFORGE_SITE = "https://www.curseforge.com/minecraft";

const PACK_CLASSES: Record<
  number,
  { folder: LauncherPackFolder; sitePath: string }
> = {
  [CURSEFORGE_CLASSES.mods]: { folder: "mods", sitePath: "mc-mods" },
  [CURSEFORGE_CLASSES.resourcePacks]: {
    folder: "resourcepacks",
    sitePath: "texture-packs",
  },
  [CURSEFORGE_CLASSES.shaders]: { folder: "shaderpacks", sitePath: "shaders" },
};

export function packFolderForClass(classId: number): LauncherPackFolder | null {
  return PACK_CLASSES[classId]?.folder ?? null;
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
  project: { websiteUrl: string | null; classId: number; slug: string },
  fileId: number,
): string | null {
  const sitePath = PACK_CLASSES[project.classId]?.sitePath;
  const projectUrl =
    project.websiteUrl?.replace(/\/+$/, "") ??
    (sitePath ? `${CURSEFORGE_SITE}/${sitePath}/${project.slug}` : null);
  return projectUrl ? `${projectUrl}/files/${fileId}` : null;
}
