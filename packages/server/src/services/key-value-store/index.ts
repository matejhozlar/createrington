import { redisService } from "@/services/redis";

const DEFAULT_MAX_ENTRIES = 5000;
const SWEEP_SHARE_OF_CAPACITY = 0.1;

/** A store of short-lived string values by key. Every value is written with a time limit. */
export interface KeyValueStore {
  /** The value under the key, or `null` when there is none or its time is up. */
  get(key: string): Promise<string | null>;
  /** The values under the keys in the order asked, `null` where there is none or its time is up. */
  getMany(keys: string[]): Promise<Array<string | null>>;
  /** Writes the value under the key for `ttlMs` milliseconds, replacing what was there. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

/**
 * Key-value store kept in process memory, so it is empty again after a
 * restart and is not shared between processes. Holds at most `maxEntries`
 * values: when it is full, the value written longest ago makes room. Expired
 * values are swept out ahead of live ones once per tenth of the capacity in
 * writes to a full store (and the first time it fills), so a write never
 * costs more than a few steps on average, whatever the capacity.
 */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  private writesUntilSweep = 0;

  constructor(private readonly maxEntries = DEFAULT_MAX_ENTRIES) {}

  /** The value under the key, or `null` when there is none or its time is up. */
  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  /** The values under the keys in the order asked, `null` where there is none or its time is up. */
  async getMany(keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  /** Writes the value under the key for `ttlMs` milliseconds, replacing what was there. */
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.makeRoom();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private makeRoom(): void {
    if (this.writesUntilSweep <= 0) {
      this.sweepExpired();
      this.writesUntilSweep = Math.ceil(
        this.maxEntries * SWEEP_SHARE_OF_CAPACITY,
      );
    } else this.writesUntilSweep--;
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) break;
      this.entries.delete(key);
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

/**
 * Key-value store kept in Redis, so it survives a restart of the app and is
 * shared between processes. Every call rejects while Redis cannot be reached.
 */
export class RedisKeyValueStore implements KeyValueStore {
  constructor(
    private readonly redis: { sendCommand(args: string[]): Promise<unknown> },
  ) {}

  /** The value under the key, or `null` when there is none or its time is up. */
  async get(key: string): Promise<string | null> {
    const reply = await this.redis.sendCommand(["GET", key]);
    return typeof reply === "string" ? reply : null;
  }

  /** The values under the keys in the order asked, in one MGET, `null` where Redis holds none. */
  async getMany(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const reply = await this.redis.sendCommand(["MGET", ...keys]);
    if (!Array.isArray(reply) || reply.length !== keys.length) {
      throw new Error(`Redis answered MGET of ${keys.length} keys oddly`);
    }
    return reply.map((value) => (typeof value === "string" ? value : null));
  }

  /** Writes the value under the key for `ttlMs` milliseconds, replacing what was there. */
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const milliseconds = Math.max(1, Math.ceil(ttlMs));
    await this.redis.sendCommand(["SET", key, value, "PX", `${milliseconds}`]);
  }
}

/**
 * Key-value store that uses `primary` while `isPrimaryUp()` says so and
 * `fallback` otherwise. A call the primary fails is answered by the fallback
 * too, so a caller never sees the primary fail. The two are not synced: what
 * was written to one is not found in the other.
 */
export class FallbackKeyValueStore implements KeyValueStore {
  constructor(
    private readonly primary: KeyValueStore,
    private readonly fallback: KeyValueStore,
    private readonly isPrimaryUp: () => boolean,
  ) {}

  /** The value under the key in the store in use, or `null` when there is none or its time is up. */
  async get(key: string): Promise<string | null> {
    if (this.isPrimaryUp()) {
      try {
        return await this.primary.get(key);
      } catch {
        return this.fallback.get(key);
      }
    }
    return this.fallback.get(key);
  }

  /** The values under the keys in the store in use, `null` where there is none or its time is up. */
  async getMany(keys: string[]): Promise<Array<string | null>> {
    if (this.isPrimaryUp()) {
      try {
        return await this.primary.getMany(keys);
      } catch {
        return this.fallback.getMany(keys);
      }
    }
    return this.fallback.getMany(keys);
  }

  /** Writes the value under the key in the store in use for `ttlMs` milliseconds. */
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (this.isPrimaryUp()) {
      try {
        await this.primary.set(key, value, ttlMs);
        return;
      } catch {
        await this.fallback.set(key, value, ttlMs);
        return;
      }
    }
    await this.fallback.set(key, value, ttlMs);
  }
}

/**
 * A key-value store of its own for one consumer: Redis while it is configured
 * and up, process memory otherwise, holding at most `maxMemoryEntries` values
 * there. Every consumer makes its own store, so what one writes in bulk never
 * makes room at the expense of another while the app runs on memory.
 */
export function createKeyValueStore(
  maxMemoryEntries = DEFAULT_MAX_ENTRIES,
): KeyValueStore {
  const memory = new MemoryKeyValueStore(maxMemoryEntries);
  return redisService.enabled
    ? new FallbackKeyValueStore(
        new RedisKeyValueStore(redisService),
        memory,
        () => redisService.isReady,
      )
    : memory;
}

/**
 * The JSON value stored under the key, or `undefined` when there is none.
 * A store that fails or holds something unreadable counts as none and is
 * logged, so a caller falls back to its source.
 */
export async function readStored<T>(
  store: KeyValueStore,
  key: string,
): Promise<T | undefined> {
  try {
    const stored = await store.get(key);
    return stored === null ? undefined : (JSON.parse(stored) as T);
  } catch (error) {
    logger.warn(`Key-value store could not read ${key}:`, error);
    return undefined;
  }
}

/**
 * The JSON values stored under the keys in the order asked, `undefined` where
 * there is none. A store that fails counts as none for every key, a value that
 * is unreadable as none for its key, and both are logged.
 */
export async function readStoredMany<T>(
  store: KeyValueStore,
  keys: string[],
): Promise<Array<T | undefined>> {
  let stored: Array<string | null>;
  try {
    stored = await store.getMany(keys);
  } catch (error) {
    logger.warn(`Key-value store could not read ${keys.length} keys:`, error);
    return keys.map(() => undefined);
  }
  return stored.map((value, index) => {
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn(`Key-value store could not read ${keys[index]}:`, error);
      return undefined;
    }
  });
}

/** Stores the value as JSON under the key for `ttlMs` milliseconds. A store that fails is logged and the value is not stored. */
export async function writeStored(
  store: KeyValueStore,
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  try {
    await store.set(key, JSON.stringify(value), ttlMs);
  } catch (error) {
    logger.warn(`Key-value store could not write ${key}:`, error);
  }
}

const loading = new Map<string, Promise<unknown>>();

/**
 * The JSON value stored under the key, or the result of `load`, which is then
 * stored for `ttlMs` milliseconds: one number, or a function that picks the
 * time by the value loaded. Callers that miss at the same time share one
 * `load`. A `load` that throws stores nothing. A store that fails only costs
 * a `load`: the read counts as a miss and the write is skipped.
 */
export async function readThrough<T>(
  store: KeyValueStore,
  key: string,
  ttlMs: number | ((value: T) => number),
  load: () => Promise<T>,
): Promise<T> {
  const stored = await readStored<T>(store, key);
  if (stored !== undefined) return stored;

  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;

  const loaded = load()
    .then(async (value) => {
      await writeStored(
        store,
        key,
        value,
        typeof ttlMs === "function" ? ttlMs(value) : ttlMs,
      );
      return value;
    })
    .finally(() => loading.delete(key));
  loading.set(key, loaded);
  return loaded;
}
