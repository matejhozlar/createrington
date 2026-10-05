const DEFAULT_MAX_ENTRIES = 5000;

/** A store of short-lived string values by key. Every value is written with a time limit. */
export interface KeyValueStore {
  /** The value under the key, or `null` when there is none or its time is up. */
  get(key: string): Promise<string | null>;
  /** Writes the value under the key for `ttlMs` milliseconds, replacing what was there. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

/**
 * Key-value store kept in process memory, so it is empty again after a
 * restart and is not shared between processes. Holds at most `maxEntries`
 * values: when it is full, the value written longest ago makes room, expired
 * ones first.
 */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<
    string,
    { value: string; expiresAt: number }
  >();

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

  /** Writes the value under the key for `ttlMs` milliseconds, replacing what was there. */
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.makeRoom();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private makeRoom(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}

export const keyValueStore: KeyValueStore = new MemoryKeyValueStore();

const loading = new Map<string, Promise<unknown>>();

/**
 * The JSON value stored under the key, or the result of `load`, which is then
 * stored for `ttlMs` milliseconds. Callers that miss at the same time share
 * one `load`. A `load` that throws stores nothing.
 */
export async function readThrough<T>(
  store: KeyValueStore,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const stored = await store.get(key);
  if (stored !== null) return JSON.parse(stored) as T;

  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;

  const loaded = load()
    .then(async (value) => {
      await store.set(key, JSON.stringify(value), ttlMs);
      return value;
    })
    .finally(() => loading.delete(key));
  loading.set(key, loaded);
  return loaded;
}
