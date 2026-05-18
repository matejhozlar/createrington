import { Q } from "@/db";

const TTL_MS = 30_000;

interface CacheEntry {
  isAdmin: boolean;
  expires: number;
}

/**
 * Admin Status Service
 *
 * Resolves the canonical isAdmin flag for a Discord user from the database,
 * fronted by a tiny in-process TTL cache. Lets auth middleware double-check
 * the isAdmin claim from a JWT without paying a DB hit on every admin
 * request, while keeping the staleness window short (30s).
 *
 * On demote/promote, callers must call invalidate(discordId) to drop the
 * cached entry so the change takes effect immediately on this instance.
 *
 * NOTE: per-process cache. With multiple server instances, an instance that
 * didn't process the demote mutation can still serve stale admin for up to
 * TTL_MS. That's intentional: the upper bound stays bounded and the JWT
 * staleness window shrinks from 15min to 30s without a cross-instance bus.
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

  async isAdmin(discordId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.cache.get(discordId);
    if (cached && cached.expires > now) {
      return cached.isAdmin;
    }

    const isAdmin = await Q.admin.exists({ discordId });
    this.cache.set(discordId, { isAdmin, expires: now + TTL_MS });
    return isAdmin;
  }

  invalidate(discordId: string): void {
    this.cache.delete(discordId);
  }
}

export const adminStatusService = AdminStatusService.getInstance();
