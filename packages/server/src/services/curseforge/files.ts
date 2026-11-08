import { curseforgeFileSchema } from "@createrington/content-gateway-client";
import { isDependency, postIds, sha1Of, type RawFile } from "./client";

export interface CurseForgeFileDetail {
  fileId: number;
  projectId: number;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  releaseType: number | null;
  gameId: number | null;
  /** Null when the author opted out of third-party distribution. */
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
}

async function fetchFiles(fileIds: number[]): Promise<RawFile[]> {
  return postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getFilesDetails",
    failure: "Failed to fetch file details",
  });
}

/** Identity and download facts of specific mod files, in one request. Unknown ids are simply absent. */
export async function getFilesDetails(
  fileIds: number[],
): Promise<CurseForgeFileDetail[]> {
  return (await fetchFiles(fileIds)).map((f) => ({
    fileId: f.id,
    projectId: f.modId,
    displayName: f.displayName ?? null,
    fileName: f.fileName ?? null,
    fileDate: f.fileDate ?? null,
    releaseType: f.releaseType ?? null,
    gameId: f.gameId ?? null,
    downloadUrl: f.downloadUrl || null,
    fileLength: f.fileLength ?? null,
    sha1: sha1Of(f.hashes),
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
    (await fetchFiles(fileIds))
      .filter((f) => f.isAvailable !== false)
      .map((f) => f.id),
  );
}

/**
 * Fetch per-file dependency info for multiple mod files in one request
 *
 * Only optional (relationType 2) and required (relationType 3) dependencies are returned.
 */
export async function getFilesDependencies(fileIds: number[]): Promise<
  Array<{
    fileId: number;
    modId: number;
    dependencies: Array<{ modId: number; relationType: number }>;
  }>
> {
  const files = await postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getFilesDependencies",
    failure: "Failed to fetch file dependencies",
  });
  return files.map((f) => ({
    fileId: f.id,
    modId: f.modId,
    dependencies: (f.dependencies ?? [])
      .filter(isDependency)
      .map((d) => ({ modId: d.modId, relationType: d.relationType })),
  }));
}
