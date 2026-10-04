import crypto from "node:crypto";
import config from "@/config";
import { findFileUrls } from "./file-lookup";

export interface SandboxFileQuery {
  fileId: number;
  sha1: string;
  size: number;
}

async function findSandboxFileUrl(
  file: SandboxFileQuery,
  urls: { publicUrl: string; internalUrl: string },
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${urls.internalUrl}/${file.fileId}`, { signal });
    if (!res.ok) {
      await res.body?.cancel();
      if (res.status !== 404) {
        logger.warn(
          `Sandbox answered ${res.status} for pack file ${file.fileId}`,
        );
      }
      return null;
    }

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 0 && declared !== file.size) {
      await res.body?.cancel();
      logger.warn(
        `Sandbox pack file ${file.fileId} has ${declared} bytes, CurseForge lists ${file.size}`,
      );
      return null;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    const sha1 = crypto.createHash("sha1").update(bytes).digest("hex");
    if (bytes.length !== file.size || sha1 !== file.sha1) {
      logger.warn(
        `Sandbox pack file ${file.fileId} does not match CurseForge's SHA-1`,
      );
      return null;
    }

    return `${urls.publicUrl}/${file.fileId}`;
  } catch (error) {
    logger.warn(`Sandbox pack file ${file.fileId} lookup failed:`, error);
    return null;
  }
}

/**
 * The launcher's download links for the files the sandbox keeps, keyed by
 * file id. A file is left out when the sandbox does not keep it, cannot be
 * reached, or serves bytes that do not match the given SHA-1 and size. The
 * whole lookup shares one 20 second budget, so a sandbox that hangs costs a
 * caller that long at most. Always empty unless both
 * `LAUNCHER_PACK_FILES_URL` and `LAUNCHER_PACK_FILES_INTERNAL_URL` are set.
 */
export async function findSandboxFileUrls(
  files: SandboxFileQuery[],
): Promise<Map<number, string>> {
  const { publicUrl, internalUrl } = config.launcher.packFiles;
  if (!publicUrl || !internalUrl) return new Map();

  return findFileUrls(files, (file, signal) =>
    findSandboxFileUrl(file, { publicUrl, internalUrl }, signal),
  );
}
