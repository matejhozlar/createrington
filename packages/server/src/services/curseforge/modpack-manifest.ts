import JSZip from "jszip";
import { z } from "zod";
import {
  createKeyValueStore,
  readStored,
  writeStored,
} from "@/services/key-value-store";
import config from "@/config";
import { MODPACK_PROJECT_ID, parseCfResponse } from "./client";
import { CF_DOWNLOAD_TIMEOUT_MS, getModFileDownloadUrl } from "./downloads";
import {
  getLatestListedModpackFile,
  getModpackFile,
  loadModpackReadContext,
  manifestDisabledModIds,
  mergeManifestFiles,
  resolveModpackRelease,
  type ModpackManifest,
} from "./modpack";

const MODPACK_CACHE_TTL = config.curseforge.modpackCacheTtlMs;
const MODPACK_INCOMPLETE_CACHE_TTL =
  config.curseforge.modpackIncompleteCacheTtlMs;

const storedModpackManifestSchema = z.object({
  fileId: z.number(),
  serverPackFileId: z.number().nullable(),
  displayName: z.string().nullable(),
  version: z.string().nullable(),
  minecraftVersion: z.string().nullable(),
  modLoader: z.string().nullable(),
  publishedAt: z.string().nullable(),
  entries: z.array(
    z.object({
      projectId: z.number(),
      fileId: z.number(),
      required: z.boolean(),
      sides: z.enum(["client", "server", "both"]),
    }),
  ),
  modIds: z.array(z.number()),
  disabledModIds: z.array(z.number()),
});

type StoredModpackManifest = z.infer<typeof storedModpackManifestSchema>;

export function toStoredModpackManifest(
  manifest: ModpackManifest,
): StoredModpackManifest {
  return {
    ...manifest,
    modIds: [...manifest.modIds],
    disabledModIds: [...manifest.disabledModIds],
  };
}

export function fromStoredModpackManifest(
  value: unknown,
): ModpackManifest | undefined {
  const parsed = storedModpackManifestSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return {
    ...parsed.data,
    modIds: new Set(parsed.data.modIds),
    disabledModIds: new Set(parsed.data.disabledModIds),
  };
}

const manifestStore = createKeyValueStore(16);

function manifestKey(packProjectId: number): string {
  return `modpack:manifest:${packProjectId}`;
}

async function readStoredManifest(
  packProjectId: number,
): Promise<ModpackManifest | undefined> {
  const stored = await readStored<unknown>(
    manifestStore,
    manifestKey(packProjectId),
  );
  return stored === undefined ? undefined : fromStoredModpackManifest(stored);
}

function storeManifest(
  packProjectId: number,
  manifest: ModpackManifest,
  ttlMs: number,
): Promise<void> {
  return writeStored(
    manifestStore,
    manifestKey(packProjectId),
    toStoredModpackManifest(manifest),
    ttlMs,
  );
}

const inFlightManifests = new Map<
  number,
  { promise: Promise<ModpackManifest>; seq: number }
>();
let readSeq = 0;

const manifestFailures = new Map<number, number>();
const MANIFEST_FAILURE_BACKOFF_MS = 60_000;
const MAX_MODPACK_ZIP_BYTES = 256 * 1024 * 1024;

const lastForcedReads = new Map<number, number>();
const FORCE_MIN_INTERVAL_MS = 10_000;

/**
 * Returns the pack version and mod project IDs of a modpack's newest release
 *
 * Resolves the release per resolveModpackRelease, downloads the client pack
 * zip and, when the release ships one, the server pack zip too, parses each
 * `manifest.json`, and caches the union for the configured TTL (a minute
 * instead when the pack ships a server pack and none was found, so the
 * next check re-reads). Concurrent cache misses share a single download,
 * and a failed fetch backs off for a minute before retrying. force skips
 * the cache and the backoff, asks CurseForge for the files again instead
 * of the gateway's cache, and waits out a read that started before the
 * call (its context predates whatever the caller just wrote) instead of
 * joining it; forced reads less than ten seconds apart share the first
 * one, which bounds what a looping caller can download.
 */
export async function getModpackManifest(
  packProjectId = MODPACK_PROJECT_ID,
  options: { force?: boolean } = {},
): Promise<ModpackManifest> {
  const lastForced = lastForcedReads.get(packProjectId);
  const force =
    options.force === true &&
    (lastForced === undefined ||
      Date.now() - lastForced >= FORCE_MIN_INTERVAL_MS);
  if (force) lastForcedReads.set(packProjectId, Date.now());
  const callSeq = readSeq;

  if (!force) {
    const stored = await readStoredManifest(packProjectId);
    if (stored) return stored;
  }

  let inFlight = inFlightManifests.get(packProjectId);
  while (force && inFlight && inFlight.seq <= callSeq) {
    await inFlight.promise.catch(() => undefined);
    inFlight = inFlightManifests.get(packProjectId);
  }
  if (inFlight) return inFlight.promise;

  const failedAt = manifestFailures.get(packProjectId);
  if (
    !force &&
    failedAt &&
    Date.now() - failedAt < MANIFEST_FAILURE_BACKOFF_MS
  ) {
    throw new Error(
      `Modpack #${packProjectId} manifest fetch recently failed, backing off`,
    );
  }

  const entry = {
    seq: ++readSeq,
    promise: fetchModpackManifest(packProjectId, force)
      .then((manifest) => {
        manifestFailures.delete(packProjectId);
        return manifest;
      })
      .catch((error) => {
        manifestFailures.set(packProjectId, Date.now());
        throw error;
      })
      .finally(() => {
        if (inFlightManifests.get(packProjectId) === entry) {
          inFlightManifests.delete(packProjectId);
        }
      }),
  };
  inFlightManifests.set(packProjectId, entry);
  return entry.promise;
}

async function fetchModpackManifest(
  packProjectId: number,
  fresh: boolean,
): Promise<ModpackManifest> {
  const context = await loadModpackReadContext(packProjectId);
  const listed = await getLatestListedModpackFile(packProjectId, fresh);
  const { file, serverPackFileId, complete } = await resolveModpackRelease(
    listed,
    context,
    (fileId) => getModpackFile(packProjectId, fileId, { fresh }),
  );

  // Sequential so only one zip is ever buffered at a time
  const client = await downloadPackManifest(packProjectId, file.id);
  const server =
    serverPackFileId === null
      ? null
      : await downloadPackManifest(packProjectId, serverPackFileId);

  const loaders = client.minecraft?.modLoaders ?? [];
  const files = mergeManifestFiles(client.files, server?.files ?? null);
  const result: ModpackManifest = {
    fileId: file.id,
    serverPackFileId,
    displayName: file.displayName,
    version: client.version ?? null,
    minecraftVersion: client.minecraft?.version ?? null,
    modLoader: (loaders.find((l) => l.primary) ?? loaders[0])?.id ?? null,
    publishedAt: file.fileDate,
    entries: files.flatMap((f) =>
      f.fileId === undefined
        ? []
        : [
            {
              projectId: f.projectId,
              fileId: f.fileId,
              required: f.required,
              sides: f.sides,
            },
          ],
    ),
    modIds: new Set(files.map((f) => f.projectId)),
    disabledModIds: manifestDisabledModIds(files),
  };
  await storeManifest(
    packProjectId,
    result,
    complete ? MODPACK_CACHE_TTL : MODPACK_INCOMPLETE_CACHE_TTL,
  );

  logger.info(
    `Cached modpack mod list: ${result.modIds.size} mods from file ${file.id}` +
      (listed?.id === file.id ? "" : " (reported by the sandbox)") +
      (serverPackFileId === null
        ? complete
          ? ""
          : " without the server pack the pack ships"
        : ` and server pack ${serverPackFileId}`),
  );

  return result;
}

const packManifestSchema = z.object({
  version: z.string().optional(),
  minecraft: z
    .object({
      version: z.string().optional(),
      modLoaders: z
        .array(z.object({ id: z.string(), primary: z.boolean().optional() }))
        .optional(),
    })
    .optional(),
  files: z.array(
    z.object({
      projectID: z.number(),
      fileID: z.number().optional(),
      required: z.boolean().optional(),
    }),
  ),
});

async function downloadPackManifest(packProjectId: number, fileId: number) {
  const downloadUrl = await getModFileDownloadUrl(packProjectId, fileId);

  const zipRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(CF_DOWNLOAD_TIMEOUT_MS),
  });
  if (!zipRes.ok) {
    throw new Error(
      `Failed to download modpack file ${fileId} (${zipRes.status})`,
    );
  }
  const contentLength = Number(zipRes.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MODPACK_ZIP_BYTES) {
    throw new Error(
      `Modpack file ${fileId} exceeds the ${MAX_MODPACK_ZIP_BYTES} byte limit (${contentLength})`,
    );
  }
  const zip = await JSZip.loadAsync(await zipRes.arrayBuffer());
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error(`No manifest.json in modpack file ${fileId}`);
  }

  const manifest = parseCfResponse(
    packManifestSchema,
    JSON.parse(await manifestFile.async("text")),
    "modpack manifest",
  );
  return {
    version: manifest.version,
    minecraft: manifest.minecraft,
    files: manifest.files.map((f) => ({
      projectId: f.projectID,
      fileId: f.fileID,
      required: f.required ?? true,
    })),
  };
}

/** The set of mod project IDs in a modpack's latest published file. */
export async function getModpackModIds(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<Set<number>> {
  return (await getModpackManifest(packProjectId)).modIds;
}
