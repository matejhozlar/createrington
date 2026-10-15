import crypto from "node:crypto";
import config from "@/config";
import { findFileUrls } from "./file-lookup";

export interface SandboxFileQuery {
  fileId: number;
  sha1: string;
  size: number;
}

export interface SandboxSnapshotQuery {
  snapshotId: number;
  sha1: string;
  size: number;
}

const SNAPSHOT_CHECK_BUDGET_MS = 60_000;

function sandboxUrls(): { publicUrl: string; internalUrl: string } | null {
  const { publicUrl, internalUrl } = config.launcher.packFiles;
  return publicUrl && internalUrl ? { publicUrl, internalUrl } : null;
}

async function verifySandboxFile(
  label: string,
  path: string,
  expected: { sha1: string; size: number },
  urls: { publicUrl: string; internalUrl: string },
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${urls.internalUrl}/${path}`, { signal });
    if (!res.ok) {
      await res.body?.cancel();
      if (res.status !== 404) {
        logger.warn(`Sandbox answered ${res.status} for ${label}`);
      }
      return null;
    }

    const declared = Number(res.headers.get("content-length"));
    if (
      Number.isFinite(declared) &&
      declared > 0 &&
      declared !== expected.size
    ) {
      await res.body?.cancel();
      logger.warn(
        `Sandbox ${label} has ${declared} bytes, ${expected.size} were expected`,
      );
      return null;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    const sha1 = crypto.createHash("sha1").update(bytes).digest("hex");
    if (bytes.length !== expected.size || sha1 !== expected.sha1) {
      logger.warn(`Sandbox ${label} does not match the expected SHA-1`);
      return null;
    }

    return `${urls.publicUrl}/${path}`;
  } catch (error) {
    logger.warn(`Sandbox ${label} lookup failed:`, error);
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
  const urls = sandboxUrls();
  if (!urls) return new Map();

  return findFileUrls(files, (file, signal) =>
    verifySandboxFile(
      `pack file ${file.fileId}`,
      String(file.fileId),
      file,
      urls,
      signal,
    ),
  );
}

/**
 * The launcher's download link for a snapshot zip the sandbox keeps, once
 * the sandbox served it through the internal address with the given SHA-1
 * and size; null when it does not, cannot be reached, or the sandbox
 * addresses are not configured. Reads the whole zip, within a minute.
 */
export async function findSandboxSnapshotUrl(
  snapshot: SandboxSnapshotQuery,
): Promise<string | null> {
  const urls = sandboxUrls();
  if (!urls) return null;

  return verifySandboxFile(
    `snapshot ${snapshot.snapshotId}`,
    `snapshot/${snapshot.snapshotId}`,
    snapshot,
    urls,
    AbortSignal.timeout(SNAPSHOT_CHECK_BUDGET_MS),
  );
}
