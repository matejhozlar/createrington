import { contentKindForClass } from "@/services/launcher/content/curseforge-content";
import type {
  LauncherContentKind,
  LauncherPackData,
  LauncherPackFileSource,
  LauncherPackFolder,
} from "@createrington/shared/launcher";

const CURSEFORGE_CDN = "https://mediafilez.forgecdn.net/files";

const PACK_FOLDERS: Record<LauncherContentKind, LauncherPackFolder> = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
};

export function packFolderForClass(classId: number): LauncherPackFolder | null {
  const kind = contentKindForClass(classId);
  return kind ? PACK_FOLDERS[kind] : null;
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
