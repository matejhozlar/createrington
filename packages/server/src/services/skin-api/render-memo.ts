interface MemoEntry<T> {
  value: Promise<T>;
  expiresAt: number;
}

/**
 * Promise memo for skin-api results keyed by player and variant. A fresh
 * entry is shared by every concurrent caller, so one skin-api call serves
 * them all; a rejected promise is dropped at once so the next caller retries,
 * and the least recently inserted entries go first once `maxEntries` is hit.
 */
export class RenderMemo<T> {
  private readonly cache = new Map<string, MemoEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  /** The memoised value for `key`, producing and storing it when missing or stale. */
  get(key: string, produce: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = produce().catch((error: unknown) => {
      this.cache.delete(key);
      throw error;
    });

    this.cache.delete(key);
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return value;
  }
}
