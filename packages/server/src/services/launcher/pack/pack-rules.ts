import type {
  LauncherPackData,
  LauncherPackFileSource,
  LauncherPackFolder,
} from "@createrington/shared/launcher";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

const CURSEFORGE_SITE = "https://www.curseforge.com/minecraft";
const CURSEFORGE_CDN = "https://mediafilez.forgecdn.net/files";

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

export function curseforgeCdnUrl(fileId: number, fileName: string): string {
  const encodedName = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${CURSEFORGE_CDN}/${Math.floor(fileId / 1000)}/${fileId % 1000}/${encodedName}`;
}

export function pickFileSource(urls: {
  curseforge: string | null;
  modrinth: string | null;
  curseforgeCdn: string | null;
  storage: string | null;
}): { source: LauncherPackFileSource; downloadUrl: string | null } {
  if (urls.curseforge)
    return { source: "curseforge", downloadUrl: urls.curseforge };
  if (urls.modrinth) return { source: "modrinth", downloadUrl: urls.modrinth };
  if (urls.curseforgeCdn)
    return { source: "curseforge-cdn", downloadUrl: urls.curseforgeCdn };
  if (urls.storage) return { source: "storage", downloadUrl: urls.storage };
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
