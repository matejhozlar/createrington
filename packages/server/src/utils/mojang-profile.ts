/**
 * Lightweight Mojang profile resolver. Looks up a Minecraft username for a
 * given UUID via Mojang's session server, with an in-memory LRU+TTL cache to
 * avoid hammering Mojang for repeat lookups.
 *
 * Cache behaviour:
 *  - Hits cached for 24h (usernames change rarely)
 *  - Misses cached for 1h (so fakeplayer / invalid UUIDs don't keep hitting
 *    the network, but we still re-check eventually)
 *  - LRU eviction when MAX_ENTRIES is reached
 */

const MOJANG_PROFILE_URL =
  "https://sessionserver.mojang.com/session/minecraft/profile/";
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
  // Refresh insertion order so this key is treated as most-recently-used.
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

/**
 * Resolves a Minecraft UUID to its current username via Mojang. Returns null
 * if Mojang has no profile for the UUID (e.g. opac-fakeplayer's all-zero
 * sentinel, or any UUID never tied to a real account).
 *
 * Throws on network failure; callers should treat that as transient.
 */
export async function getMojangUsername(uuid: string): Promise<string | null> {
  const cached = cacheGet(uuid);
  if (cached !== undefined) return cached;

  const undashed = uuid.replace(/-/g, "");
  const res = await fetch(`${MOJANG_PROFILE_URL}${undashed}`);

  if (res.status === 200) {
    const body = (await res.json()) as { name?: string };
    const username = body.name ?? null;
    cacheSet(uuid, username);
    return username;
  }
  if (res.status === 204 || res.status === 404) {
    cacheSet(uuid, null);
    return null;
  }

  throw new Error(`Mojang profile lookup failed (${res.status}) for ${uuid}`);
}
