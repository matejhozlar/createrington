import { Q } from "@/db";
import type { FeatureFlag } from "@createrington/shared/db";

export const FeatureFlags = {
  workshop: "workshop",
} as const;

export type FeatureFlagName = (typeof FeatureFlags)[keyof typeof FeatureFlags];

const CACHE_TTL_MS = 10_000;

/**
 * Runtime feature switches backed by the feature_flag table.
 * Reads are cached briefly so per-request gating stays cheap; writes
 * invalidate the cache immediately. A missing flag reads as disabled.
 */
export class FeatureFlagService {
  private cache = new Map<string, { enabled: boolean; fetchedAt: number }>();

  /** Whether the named feature is currently enabled. */
  async isEnabled(name: string): Promise<boolean> {
    const cached = this.cache.get(name);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.enabled;
    }

    const flag = await Q.feature.flag.find({ name });
    const enabled = flag?.enabled ?? false;
    this.cache.set(name, { enabled, fetchedAt: Date.now() });
    return enabled;
  }

  /** Enable or disable a flag, creating it if it does not exist. */
  async setEnabled(
    name: string,
    enabled: boolean,
    description?: string,
  ): Promise<FeatureFlag> {
    const flag = await Q.feature.flag.upsert(
      {
        name,
        enabled,
        ...(description !== undefined ? { description } : {}),
        updatedAt: new Date(),
      },
      "name",
      description !== undefined
        ? ["enabled", "description", "updatedAt"]
        : ["enabled", "updatedAt"],
    );
    this.cache.delete(name);
    return flag;
  }

  /** All flags, for the admin panel. */
  async list(): Promise<FeatureFlag[]> {
    return Q.feature.flag.orderBy("name").all();
  }
}

export const featureFlagService = new FeatureFlagService();
