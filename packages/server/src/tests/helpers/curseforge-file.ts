import type { CurseForgeFile } from "@/services/curseforge/client";

export function curseforgeFile(
  overrides: Partial<CurseForgeFile> & { id: number },
): CurseForgeFile {
  return {
    projectId: 1,
    gameId: null,
    displayName: null,
    fileName: null,
    fileDate: null,
    releaseType: null,
    downloadUrl: null,
    fileLength: null,
    sha1: null,
    gameVersions: [],
    dependencies: [],
    fileStatus: null,
    isAvailable: true,
    serverPackFileId: null,
    alternateFileId: null,
    parentProjectFileId: null,
    isServerPack: false,
    ...overrides,
  };
}
