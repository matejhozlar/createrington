import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { z } from "zod";
import {
  curseforgeData,
  type FileSource,
} from "@createrington/content-gateway-client";
import { contentGateway, currentContentPool } from "@/services/content-gateway";
import { answerText, cfFetch, parseCfResponse } from "./client";

export const CF_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Fetch the direct download URL for a specific mod file */
export async function getModFileDownloadUrl(
  modId: number,
  fileId: number,
): Promise<string> {
  const answer = await cfFetch(`mods/${modId}/files/${fileId}/download-url`);
  if (!answer.ok) {
    throw new Error(
      `CurseForge getDownloadUrl failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  return parseCfResponse(
    curseforgeData(z.string()),
    answer.body,
    "getDownloadUrl",
  ).data;
}

/** Where a file can be downloaded from, as the gateway resolved it. */
export interface CurseForgeFileDownload {
  /** CurseForge's own link, Modrinth's copy, the built CDN address, or null when no source has the file. */
  source: FileSource | null;
  url: string | null;
  /** True when a source could not be asked this time, so a null `source` is worth asking again rather than remembering. */
  retry: boolean;
}

/**
 * A download address per CurseForge file id, from the gateway's resolve:
 * CurseForge's own link, else Modrinth's copy of the file found by SHA-1,
 * else, when `cdn` is on, the file's built address on CurseForge's CDN when
 * it answers there with the file's size. A file CurseForge does not know
 * comes back with no source. Throws when the gateway refuses the call or
 * CurseForge cannot be asked.
 */
export async function resolveFileDownloads(
  fileIds: number[],
  options: { cdn: boolean; timeoutMs?: number },
): Promise<Map<number, CurseForgeFileDownload>> {
  if (fileIds.length === 0) return new Map();
  const { files } = await contentGateway().resolve(fileIds, {
    cdn: options.cdn,
    pool: currentContentPool(),
    timeoutMs: options.timeoutMs,
  });
  return new Map(
    files.map((file) => [
      file.fileId,
      {
        source: file.source ?? null,
        url: file.url ?? null,
        retry: file.retry,
      },
    ]),
  );
}

/**
 * Download a mod file from CurseForge into the given directory using a stream
 * pipeline, returning the saved file's absolute path
 */
export async function downloadModFile(
  modId: number,
  fileId: number,
  destDir: string,
  fileName: string,
): Promise<string> {
  const downloadUrl = await getModFileDownloadUrl(modId, fileId);

  const destPath = path.join(destDir, fileName);
  await fs.promises.mkdir(destDir, { recursive: true });

  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(CF_DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `CurseForge download failed (${res.status}) for mod ${modId} file ${fileId}`,
    );
  }

  const fileStream = fs.createWriteStream(destPath);
  const readable = Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream,
  );
  await pipeline(readable, fileStream);

  return destPath;
}
