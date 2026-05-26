import { Q } from "@/db";

const TTL_MS = 30_000;
const MAX_ENTRIES = 512;

interface CacheEntry {
  isAdmin: boolean;
  expires: number;
}

/**
 * In-memory TTL cache (30s, capped at 512 entries) for the `Q.admin.exists` lookup,
 * fronting hot-path admin checks so request middleware does not re-hit the database on
 * every call. Singleton; cache lives for the process lifetime.
 */
class AdminStatusService {
  private static instance: AdminStatusService;
  private cache = new Map<string, CacheEntry>();

  private constructor() {}

  static getInstance(): AdminStatusService {
    if (!AdminStatusService.instance) {
      AdminStatusService.instance = new AdminStatusService();
    }
    return AdminStatusService.instance;
  }

  /** Returns whether the user is an admin, serving cached results for up to 30s. */
  async isAdmin(discordId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.cache.get(discordId);
    if (cached && cached.expires > now) {
      return cached.isAdmin;
    }

    const isAdmin = await Q.admin.exists({ discordId });
    if (this.cache.size >= MAX_ENTRIES) this.pruneExpired(now);
    this.cache.set(discordId, { isAdmin, expires: now + TTL_MS });
    return isAdmin;
  }

  /** Drops the cached entry for a user so the next `isAdmin` call re-queries the database. */
  invalidate(discordId: string): void {
    this.cache.delete(discordId);
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }
  }
}

export const adminStatusService = AdminStatusService.getInstance();
