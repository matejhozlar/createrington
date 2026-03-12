import type { RateLimitBucket } from "./types";

/**
 * Manages Discord API rate limit buckets
 *
 * Discord uses a bucket system where endpoints share rate limits.
 * Each bucket has its own limit, remaining count, and reset time.
 */
export class BucketManager {
  private buckets = new Map<string, RateLimitBucket>();
  private routeToBucket = new Map<string, string>();

  private globalRateLimit: {
    active: boolean;
    resetAt: number;
  } = {
    active: false,
    resetAt: 0,
  };

  /**
   * Update bucket information from Discord API response headers
   *
   * Discord returns rate limit info in headers:
   * - X-RateLimit-Bucket: Bucket ID
   * - X-RateLimit-Limit: Max requests
   * - X-RateLimit-Remaining: Remaining requests
   * - X-RateLimit-Reset: Reset timestamp
   * - X-RateLimit-Reset-After: Seconds until reset
   * - X-RateLimit-Global: If true, global rate limit
   */
  updateFromHeaders(route: string, headers: Record<string, string>): void {
    const bucketId = headers["x-ratelimit-bucket"];
    if (!bucketId) return;

    const bucket: RateLimitBucket = {
      id: bucketId,
      limit: parseInt(headers["x-ratelimit-limit"] || "0", 10),
      remaining: parseInt(headers["x-ratelimit-remaining"] || "0", 10),
      reset: parseFloat(headers["x-ratelimit-reset"] || "0"),
      resetAfter: parseFloat(headers["x-ratelimit-reset-after"] || "0"),
      global: headers["x-ratelimit-global"] === "true",
    };

    this.buckets.set(bucketId, bucket);
    this.routeToBucket.set(route, bucketId);

    if (bucket.global) {
      this.setGlobalRateLimit(bucket.resetAfter);
    }

    logger.debug(`Updated bucket ${bucketId} for route ${route}:`, {
      remaining: bucket.remaining,
      limit: bucket.limit,
      resetAfter: bucket.resetAfter,
    });
  }

  /**
   * Handles a 429 response by zeroing the bucket's remaining count or activating the global limiter
   *
   * @param route - The API route that received the 429
   * @param retryAfter - Seconds to wait before retrying
   * @param global - Whether this is a global rate limit
   */
  handle429(route: string, retryAfter: number, global: boolean): void {
    logger.warn(`Rate limit hir for route ${route}:`, {
      retryAfter,
      global,
    });

    if (global) {
      this.setGlobalRateLimit(retryAfter);
    } else {
      const bucketId = this.routeToBucket.get(route);
      if (bucketId) {
        const bucket = this.buckets.get(bucketId);
        if (bucket) {
          bucket.remaining = 0;
          bucket.reset = Date.now() / 1000 + retryAfter;
          bucket.resetAfter = retryAfter;
        }
      }
    }
  }

  /**
   * Checks whether a route is allowed to make a request right now
   *
   * @param route - The API route to check
   * @returns Object with `allowed` flag, `waitTime` in ms, and optional `reason`
   */
  canRequest(route: string): {
    allowed: boolean;
    waitTime: number;
    reason?: string;
  } {
    if (this.globalRateLimit.active) {
      const waitTime = Math.max(0, this.globalRateLimit.resetAt - Date.now());
      if (waitTime > 0) {
        return {
          allowed: false,
          waitTime,
          reason: "global_rate_limit",
        };
      }
      this.globalRateLimit.active = false;
    }

    const bucketId = this.routeToBucket.get(route);
    if (!bucketId) {
      return { allowed: true, waitTime: 0 };
    }

    const bucket = this.buckets.get(bucketId);
    if (!bucket) {
      return { allowed: true, waitTime: 0 };
    }

    if (bucket.remaining > 0) {
      return { allowed: true, waitTime: 0 };
    }

    const now = Date.now() / 1000;
    const waitTime = Math.max(0, (bucket.reset - now) * 1000);

    if (waitTime <= 0) {
      return { allowed: true, waitTime: 0 };
    }

    return {
      allowed: false,
      waitTime,
      reason: `bucket_${bucketId}_depleted`,
    };
  }

  /** Decrements the remaining count for the bucket associated with this route */
  consumeRequest(route: string): void {
    const bucketId = this.routeToBucket.get(route);
    if (!bucketId) return;

    const bucket = this.buckets.get(bucketId);
    if (!bucket) return;

    if (bucket.remaining > 0) {
      bucket.remaining--;
    }
  }

  /** @private Activates the global rate limit for the given duration */
  private setGlobalRateLimit(retryAfter: number): void {
    this.globalRateLimit = {
      active: true,
      resetAt: Date.now() + retryAfter * 1000,
    };

    logger.error(`Global rate limit activated for ${retryAfter}s`);
  }

  /** Returns the bucket associated with a route, or null if unknown */
  getBucket(route: string): RateLimitBucket | null {
    const bucketId = this.routeToBucket.get(route);
    if (!bucketId) return null;
    return this.buckets.get(bucketId) || null;
  }

  /** Returns all tracked buckets (for stats/debugging) */
  getAllBuckets(): RateLimitBucket[] {
    return Array.from(this.buckets.values());
  }

  /** Returns true if the global rate limit is currently in effect */
  isGlobalRateLimitActive(): boolean {
    if (!this.globalRateLimit.active) return false;

    const waitTime = this.globalRateLimit.resetAt - Date.now();
    if (waitTime <= 0) {
      this.globalRateLimit.active = false;
      return false;
    }

    return false;
  }

  /** Removes buckets whose reset time is more than 5 minutes in the past */
  cleanup(): void {
    const now = Date.now() / 1000;
    const expiredBuckets: string[] = [];

    this.buckets.forEach((bucket, bucketId) => {
      if (bucket.reset + 300 < now) {
        expiredBuckets.push(bucketId);
      }
    });

    expiredBuckets.forEach((bucketId) => {
      this.buckets.delete(bucketId);

      this.routeToBucket.forEach((mappedBucketId, route) => {
        if (mappedBucketId === bucketId) {
          this.routeToBucket.delete(route);
        }
      });
    });

    if (expiredBuckets.length > 0) {
      logger.debug(`Cleaned up ${expiredBuckets.length} expired buckets`);
    }
  }
}
