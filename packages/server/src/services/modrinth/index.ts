import { z } from "zod";
import config from "@/config";

const MODRINTH_API = "https://api.modrinth.com";
const MODRINTH_CDN_HOST = "cdn.modrinth.com";
const MODRINTH_FETCH_TIMEOUT_MS = 15_000;

const versionFilesSchema = z.record(
  z.string(),
  z.object({
    files: z.array(
      z.object({
        hashes: z.object({ sha1: z.string() }),
        url: z.string(),
        filename: z.string(),
        size: z.number(),
      }),
    ),
  }),
);

export interface ModrinthFile {
  sha1: string;
  url: string;
  fileName: string;
  size: number;
}

function isCdnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === MODRINTH_CDN_HOST;
  } catch {
    return false;
  }
}

/**
 * Files Modrinth hosts with exactly these SHA-1 hashes, keyed by lowercase
 * hash. A hash Modrinth does not know is absent. Only the file whose own
 * hash matches is returned, never another file of the same version.
 */
export async function findModrinthFilesBySha1(
  hashes: string[],
): Promise<Map<string, ModrinthFile>> {
  const wanted = new Set(hashes.map((hash) => hash.toLowerCase()));
  if (wanted.size === 0) return new Map();

  const res = await fetch(`${MODRINTH_API}/v2/version_files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `createrington/app (${config.meta.links.website})`,
    },
    body: JSON.stringify({ hashes: [...wanted], algorithm: "sha1" }),
    signal: AbortSignal.timeout(MODRINTH_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Modrinth version_files failed (${res.status})`);
  }

  const parsed = versionFilesSchema.safeParse(await res.json());
  if (!parsed.success) {
    logger.warn(
      `Modrinth version_files response shape mismatch: ${parsed.error.message}`,
    );
    throw new Error("Modrinth version_files returned an unexpected response");
  }

  const found = new Map<string, ModrinthFile>();
  for (const version of Object.values(parsed.data)) {
    for (const file of version.files) {
      const sha1 = file.hashes.sha1.toLowerCase();
      if (!wanted.has(sha1) || found.has(sha1) || !isCdnUrl(file.url)) {
        continue;
      }
      found.set(sha1, {
        sha1,
        url: file.url,
        fileName: file.filename,
        size: file.size,
      });
    }
  }
  return found;
}
