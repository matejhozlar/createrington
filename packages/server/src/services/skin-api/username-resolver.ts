import { SkinApiError } from "createrington-skin-api";
import { getSkinApiClient } from "./index";

const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

interface CacheEntry {
  username: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(uuid: string): string | null | undefined {
  const entry = cache.get(uuid);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(uuid);
    return undefined;
  }
  cache.delete(uuid);
  cache.set(uuid, entry);
  return entry.username;
}

function cacheSet(uuid: string, username: string | null): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(uuid, {
    username,
    expiresAt: Date.now() + (username === null ? MISS_TTL_MS : HIT_TTL_MS),
  });
}

export async function resolveUsername(
  minecraftUuid: string,
): Promise<string | null> {
  const uuid = minecraftUuid.toLowerCase();
  const cached = cacheGet(uuid);
  if (cached !== undefined) return cached;

  try {
    const profile = await getSkinApiClient().resolve({ uuid });
    cacheSet(uuid, profile.username);
    return profile.username;
  } catch (error) {
    if (error instanceof SkinApiError && error.status === 404) {
      cacheSet(uuid, null);
      return null;
    }
    throw error;
  }
}
