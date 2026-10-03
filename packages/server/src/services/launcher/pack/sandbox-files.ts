import crypto from "node:crypto";
import config from "@/config";

const SANDBOX_STEP_TIMEOUT_MS = 20_000;
const SANDBOX_CONCURRENCY = 8;

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
  const found = new Map<number, string>();
  const { publicUrl, internalUrl } = config.launcher.packFiles;
  if (!publicUrl || !internalUrl || files.length === 0) return found;

  const signal = AbortSignal.timeout(SANDBOX_STEP_TIMEOUT_MS);
  const queue = [...files];
  await Promise.all(
    Array.from(
      { length: Math.min(SANDBOX_CONCURRENCY, queue.length) },
      async () => {
        for (let file = queue.shift(); file; file = queue.shift()) {
          if (signal.aborted) return;
          const url = await findSandboxFileUrl(
            file,
            { publicUrl, internalUrl },
            signal,
          );
          if (url) found.set(file.fileId, url);
        }
      },
    ),
  );
  return found;
}
