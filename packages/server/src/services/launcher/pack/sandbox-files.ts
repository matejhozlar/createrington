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

export interface SandboxDownload {
  body: ReadableStream<Uint8Array>;
  size: number;
}

export class SandboxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxUnavailableError";
  }
}

const SNAPSHOT_CHECK_BUDGET_MS = 60_000;
const DOWNLOAD_HEADERS_TIMEOUT_MS = 10_000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;
const DOWNLOAD_TOTAL_TIMEOUT_MS = 30 * 60_000;
const STORAGE_FILES_PATH = "/api/launcher/packs/files";
const WEBSITE_FALLBACK_URL = "https://createrington.com";

function internalUrl(): string | null {
  return config.launcher.packFiles.internalUrl;
}

function storageUrl(path: string): string {
  const website = (config.meta.links.website ?? WEBSITE_FALLBACK_URL).replace(
    /\/+$/,
    "",
  );
  return `${website}${STORAGE_FILES_PATH}/${path}`;
}

/** The app's own download link for a jar the sandbox keeps under this CurseForge file id. */
export function storageFileUrl(fileId: number): string {
  return storageUrl(String(fileId));
}

/** The app's own download link for the pack zip of a test snapshot. */
export function storageSnapshotUrl(snapshotId: number): string {
  return storageUrl(`snapshot/${snapshotId}`);
}

async function verifySandboxFile(
  label: string,
  path: string,
  expected: { sha1: string; size: number },
  baseUrl: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/${path}`, { signal });
    if (!res.ok) {
      await res.body?.cancel();
      if (res.status !== 404) {
        logger.warn(`Sandbox answered ${res.status} for ${label}`);
      }
      return false;
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
      return false;
    }

    const hash = crypto.createHash("sha1");
    let received = 0;
    for await (const chunk of res.body ?? []) {
      received += chunk.byteLength;
      if (received > expected.size) {
        logger.warn(
          `Sandbox ${label} is longer than the ${expected.size} bytes expected`,
        );
        return false;
      }
      hash.update(chunk);
    }
    if (received !== expected.size || hash.digest("hex") !== expected.sha1) {
      logger.warn(`Sandbox ${label} does not match the expected SHA-1`);
      return false;
    }

    return true;
  } catch (error) {
    logger.warn(`Sandbox ${label} lookup failed:`, error);
    return false;
  }
}

/**
 * The launcher's download links for the files the sandbox keeps, keyed by
 * file id. A file is left out when the sandbox does not keep it, cannot be
 * reached, or serves bytes that do not match the given SHA-1 and size. The
 * links point at the app's own download routes, which stream the file from
 * the sandbox. The whole lookup shares one 20 second budget, so a sandbox
 * that hangs costs a caller that long at most. Always empty unless
 * `LAUNCHER_PACK_FILES_INTERNAL_URL` is set.
 */
export async function findSandboxFileUrls(
  files: SandboxFileQuery[],
): Promise<Map<number, string>> {
  const baseUrl = internalUrl();
  if (!baseUrl) return new Map();

  return findFileUrls(files, async (file, signal) =>
    (await verifySandboxFile(
      `pack file ${file.fileId}`,
      String(file.fileId),
      file,
      baseUrl,
      signal,
    ))
      ? storageFileUrl(file.fileId)
      : null,
  );
}

/**
 * The launcher's download link for a snapshot zip the sandbox keeps, once
 * the sandbox served it through the internal address with the given SHA-1
 * and size; null when it does not, cannot be reached, or the internal
 * address is not configured. Reads the whole zip, within a minute.
 */
export async function findSandboxSnapshotUrl(
  snapshot: SandboxSnapshotQuery,
): Promise<string | null> {
  const baseUrl = internalUrl();
  if (!baseUrl) return null;

  const kept = await verifySandboxFile(
    `snapshot ${snapshot.snapshotId}`,
    `snapshot/${snapshot.snapshotId}`,
    snapshot,
    baseUrl,
    AbortSignal.timeout(SNAPSHOT_CHECK_BUDGET_MS),
  );
  return kept ? storageSnapshotUrl(snapshot.snapshotId) : null;
}

function watchProgress(
  body: ReadableStream<Uint8Array>,
  abort: (reason: Error) => void,
): ReadableStream<Uint8Array> {
  const timers: { idle?: NodeJS.Timeout; total?: NodeJS.Timeout } = {};
  const stop = () => {
    clearTimeout(timers.idle);
    clearTimeout(timers.total);
  };
  const fail = (reason: Error) => {
    stop();
    abort(reason);
  };
  const armIdle = () => {
    clearTimeout(timers.idle);
    timers.idle = setTimeout(
      () =>
        fail(
          new Error(
            `no bytes arrived for ${DOWNLOAD_IDLE_TIMEOUT_MS / 1000} seconds`,
          ),
        ),
      DOWNLOAD_IDLE_TIMEOUT_MS,
    );
  };
  timers.total = setTimeout(
    () =>
      fail(
        new Error(
          `the download did not finish within ${DOWNLOAD_TOTAL_TIMEOUT_MS / 60_000} minutes`,
        ),
      ),
    DOWNLOAD_TOTAL_TIMEOUT_MS,
  );
  armIdle();

  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      armIdle();
      controller.enqueue(chunk);
    },
  });
  body.pipeTo(progress.writable).then(stop, stop);
  return progress.readable;
}

/**
 * Opens a file the sandbox keeps for streaming to the launcher: the body as
 * the sandbox sends it, once its headers arrived within ten seconds, no
 * redirect followed. `null` when the sandbox has no such file. Throws
 * `SandboxUnavailableError` when the internal address is not configured,
 * the sandbox cannot be reached, answers with an error, or declares a size
 * other than `size`. Aborting `signal` cancels the download. The body fails
 * and the sandbox connection is dropped once no bytes arrive for thirty
 * seconds, or the whole download takes longer than thirty minutes.
 */
export async function openSandboxFile(
  path: string,
  size: number,
  signal: AbortSignal,
): Promise<SandboxDownload | null> {
  const baseUrl = internalUrl();
  if (!baseUrl) {
    throw new SandboxUnavailableError("The sandbox address is not configured");
  }

  const upstream = new AbortController();
  const abortUpstream = () => upstream.abort(signal.reason);
  if (signal.aborted) abortUpstream();
  else signal.addEventListener("abort", abortUpstream, { once: true });
  const headersTimer = setTimeout(
    () => upstream.abort(new Error("The sandbox sent no headers in time")),
    DOWNLOAD_HEADERS_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/${path}`, {
      signal: upstream.signal,
      redirect: "manual",
    });
  } catch (error) {
    signal.removeEventListener("abort", abortUpstream);
    throw new SandboxUnavailableError(
      `The sandbox could not be reached for ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(headersTimer);
  }

  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  if (res.status !== 200 || !res.body) {
    await res.body?.cancel();
    throw new SandboxUnavailableError(
      `The sandbox answered ${res.status} for ${path}`,
    );
  }

  const header = res.headers.get("content-length");
  const declared = header === null ? NaN : Number(header);
  if (!Number.isInteger(declared) || declared !== size) {
    await res.body.cancel();
    throw new SandboxUnavailableError(
      header === null
        ? `The sandbox serves ${path} without a size`
        : `The sandbox serves ${path} with ${header} bytes, ${size} were expected`,
    );
  }

  const body = watchProgress(res.body, (reason) => {
    logger.warn(`Storage download ${path} was dropped: ${reason.message}`);
    upstream.abort(reason);
  });
  return { body, size };
}
