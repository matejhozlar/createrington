import { curseforgeFileSchema } from "@createrington/content-gateway-client";
import { postIds, toCurseForgeFile, type CurseForgeFile } from "./client";

export type CurseForgeFileDetail = { fileId: number } & Pick<
  CurseForgeFile,
  | "projectId"
  | "displayName"
  | "fileName"
  | "fileDate"
  | "releaseType"
  | "gameId"
  | "downloadUrl"
  | "fileLength"
  | "sha1"
>;

/** Files by id, in one request. Unknown ids are simply absent. */
export async function getFiles(fileIds: number[]): Promise<CurseForgeFile[]> {
  const files = await postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getFiles",
  });
  return files.map(toCurseForgeFile);
}

/** Identity and download facts of specific mod files, in one request. Unknown ids are simply absent. */
export async function getFilesDetails(
  fileIds: number[],
): Promise<CurseForgeFileDetail[]> {
  return (await getFiles(fileIds)).map((file) => ({
    fileId: file.id,
    projectId: file.projectId,
    displayName: file.displayName,
    fileName: file.fileName,
    fileDate: file.fileDate,
    releaseType: file.releaseType,
    gameId: file.gameId,
    downloadUrl: file.downloadUrl,
    fileLength: file.fileLength,
    sha1: file.sha1,
  }));
}

/**
 * Of the given file ids (mod files or pack files), the ones CurseForge still
 * serves, in one request. An archived file stays known to the API and keeps
 * its download link, it only reads as not available, so that flag decides; an
 * id CurseForge does not know is left out as well.
 */
export async function getServedFileIds(
  fileIds: number[],
): Promise<Set<number>> {
  return new Set(
    (await getFiles(fileIds))
      .filter((file) => file.isAvailable)
      .map((file) => file.id),
  );
}

/** The optional and required dependencies of multiple mod files, in one request. */
export async function getFilesDependencies(fileIds: number[]): Promise<
  Array<{
    fileId: number;
    modId: number;
    dependencies: Array<{ modId: number; relationType: number }>;
  }>
> {
  return (await getFiles(fileIds)).map((file) => ({
    fileId: file.id,
    modId: file.projectId,
    dependencies: file.dependencies.map((dependency) => ({
      modId: dependency.projectId,
      relationType: dependency.relationType,
    })),
  }));
}
