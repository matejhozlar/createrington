import crypto from "node:crypto";
import config from "@/config";

const SANDBOX_FETCH_TIMEOUT_MS = 60_000;

export interface SandboxFileQuery {
  fileId: number;
  sha1: string;
  size: number;
}

/**
 * The launcher's download link for a file the sandbox keeps, or null when the
 * sandbox does not keep it, cannot be reached, or serves bytes that do not
 * match the given SHA-1 and size. Always null while `LAUNCHER_PACK_FILES_URL`
 * is not set.
 */
export async function findSandboxFileUrl(
  file: SandboxFileQuery,
): Promise<string | null> {
  const { publicUrl, internalUrl } = config.launcher.packFiles;
  if (!publicUrl || !internalUrl) return null;

  try {
    const res = await fetch(`${internalUrl}/${file.fileId}`, {
      signal: AbortSignal.timeout(SANDBOX_FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      logger.warn(
        `Sandbox answered ${res.status} for pack file ${file.fileId}`,
      );
      return null;
    }

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 0 && declared !== file.size) {
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

    return `${publicUrl}/${file.fileId}`;
  } catch (error) {
    logger.warn(`Sandbox pack file ${file.fileId} lookup failed:`, error);
    return null;
  }
}
