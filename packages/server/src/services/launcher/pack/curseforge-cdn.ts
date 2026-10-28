import { findFileUrls, resolveFileUrls } from "./file-lookup";
import { curseforgeCdnUrl } from "./pack-rules";

export interface CurseforgeCdnFileQuery {
  fileId: number;
  fileName: string;
  size: number;
}

async function findCurseforgeCdnUrl(
  file: CurseforgeCdnFileQuery,
  signal: AbortSignal,
): Promise<string | null | undefined> {
  const url = curseforgeCdnUrl(file.fileId, file.fileName);
  try {
    const res = await fetch(url, { method: "HEAD", signal });
    if (res.status !== 200) {
      if (res.status !== 403) {
        logger.warn(
          `CurseForge's CDN answered ${res.status} for file ${file.fileId}`,
        );
      }
      return null;
    }

    const declared = res.headers.get("content-length");
    if (declared === null || Number(declared) !== file.size) {
      logger.warn(
        `CurseForge's CDN lists ${declared ?? "no size"} for file ${file.fileId}, CurseForge's API lists ${file.size} bytes`,
      );
      return null;
    }

    return url;
  } catch (error) {
    logger.warn(`CurseForge CDN lookup of file ${file.fileId} failed:`, error);
    return undefined;
  }
}

/**
 * The launcher's download links for files CurseForge's API gives no link for,
 * keyed by file id: each file's address on CurseForge's CDN, built from its id
 * and name. The address is unofficial, so a file is left out unless a HEAD
 * request answers 200 with the given size; the bytes are not read, the
 * launcher verifies the SHA-1 when it downloads. An address that is missing
 * answers 403. The whole lookup shares one 20 second budget.
 */
export async function findCurseforgeCdnUrls(
  files: CurseforgeCdnFileQuery[],
): Promise<Map<number, string>> {
  return findFileUrls(files, findCurseforgeCdnUrl);
}

/**
 * Like `findCurseforgeCdnUrls`, within `budgetMs`, but tells an answer from
 * none: a file the CDN answered for is in the map, with its address or with
 * null when the CDN does not have it at the given size. A file is absent
 * when the CDN could not be reached for it or the budget ran out before it
 * was asked, so a caller that remembers misses does not remember those.
 */
export async function resolveCurseforgeCdnUrls(
  files: CurseforgeCdnFileQuery[],
  budgetMs: number,
): Promise<Map<number, string | null>> {
  return resolveFileUrls(files, findCurseforgeCdnUrl, budgetMs);
}
