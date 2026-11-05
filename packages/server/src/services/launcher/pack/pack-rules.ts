import type { FileSource } from "@createrington/content-gateway-client";
import { contentKindForClass } from "@/services/launcher/content/curseforge-content";
import type {
  LauncherContentKind,
  LauncherPackData,
  LauncherPackFileSource,
  LauncherPackFolder,
} from "@createrington/shared/launcher";

const PACK_FOLDERS: Record<LauncherContentKind, LauncherPackFolder> = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
};

export function packFolderForClass(classId: number): LauncherPackFolder | null {
  const kind = contentKindForClass(classId);
  return kind ? PACK_FOLDERS[kind] : null;
}

export function pickFileSource(urls: {
  curseforge: string | null;
  resolved: { source: FileSource | null; url: string | null } | null;
  storage: string | null;
}): { source: LauncherPackFileSource; downloadUrl: string | null } {
  if (urls.curseforge)
    return { source: "curseforge", downloadUrl: urls.curseforge };
  if (urls.resolved?.source && urls.resolved.url)
    return { source: urls.resolved.source, downloadUrl: urls.resolved.url };
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
