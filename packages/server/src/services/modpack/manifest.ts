import { Q } from "@/db";
import config from "@/config";
import {
  createKeyValueStore,
  readStored,
  writeStored,
} from "@/services/key-value-store";
import { MODPACK_PROJECT_ID } from "@/services/curseforge/client";
import {
  fromStoredModpackManifest,
  toStoredModpackManifest,
  type ModpackManifest,
  type ModpackReadContext,
} from "@/services/curseforge/modpack";
import { readModpackManifest } from "@/services/curseforge/modpack-manifest";

const MODPACK_CACHE_TTL = config.curseforge.modpackCacheTtlMs;
const MODPACK_INCOMPLETE_CACHE_TTL =
  config.curseforge.modpackIncompleteCacheTtlMs;
const RECENT_PUBLISHES = 5;

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

const lastForcedReads = new Map<number, number>();
const FORCE_MIN_INTERVAL_MS = 10_000;

/**
 * Returns the pack version and mod project IDs of a modpack's newest release
 *
 * Resolves the release per resolveModpackRelease with what the sandbox
 * reported for the pack (read here, so every caller of a pack shares one
 * cached answer), downloads the client pack zip and, when the release ships
 * one, the server pack zip too, parses each `manifest.json`, and caches the
 * union for the configured TTL (a minute instead when the pack ships a
 * server pack and none was found, so the next check re-reads). Concurrent cache misses share a single download,
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
    promise: readAndStoreManifest(packProjectId, force)
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

async function loadReadContext(
  packProjectId: number,
): Promise<ModpackReadContext> {
  const modpack = await Q.modpack.find({ curseforgeProjectId: packProjectId });
  if (!modpack) return { shipsServerPack: false, publishes: [] };
  const publishes = await Q.modpack.publish.findAll(
    { modpackId: modpack.id },
    {
      select: ["clientFileId", "serverPackFileId"],
      orderBy: "clientFileId",
      orderDirection: "desc",
      limit: RECENT_PUBLISHES,
    },
  );
  return {
    shipsServerPack: modpack.shipsServerPack,
    publishes: publishes.map((publish) => ({
      clientFileId: publish.clientFileId,
      serverPackFileId: publish.serverPackFileId,
    })),
  };
}

async function readAndStoreManifest(
  packProjectId: number,
  fresh: boolean,
): Promise<ModpackManifest> {
  const context = await loadReadContext(packProjectId);
  const { manifest, complete } = await readModpackManifest(
    packProjectId,
    context,
    { fresh },
  );
  await storeManifest(
    packProjectId,
    manifest,
    complete ? MODPACK_CACHE_TTL : MODPACK_INCOMPLETE_CACHE_TTL,
  );
  return manifest;
}

/** The set of mod project IDs in a modpack's latest published file. */
export async function getModpackModIds(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<Set<number>> {
  return (await getModpackManifest(packProjectId)).modIds;
}

export async function findModpackModIds(
  packProjectId: number,
): Promise<Set<number>> {
  try {
    return await getModpackModIds(packProjectId);
  } catch (error) {
    logger.warn(
      `Modpack manifest fetch failed for pack ${packProjectId}, search results will report inModpack: false`,
      error,
    );
    return new Set();
  }
}
