import { TRPCError } from "@trpc/server";
import { middleware } from "@/trpc/trpc";
import type { Context } from "@/trpc/context";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key: (ctx: Context) => string;
  name: string;
}

export function createRateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return middleware(async ({ ctx, next }) => {
    const now = Date.now();
    const key = opts.key(ctx);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    // Prune before the limit check so cleanup happens on every request,
    // not just non-rate-limited ones. Without this, a sustained attack
    // from many unique IPs would never trigger pruning.
    if (buckets.size > opts.limit * 4) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) {
          buckets.delete(k);
          break;
        }
      }
    }

    if (bucket.count > opts.limit) {
      const retryInSec = Math.ceil((bucket.resetAt - now) / 1000);
      logger.warn(
        `[trpc rate-limit] ${opts.name} exceeded by ${key} (${bucket.count}/${opts.limit})`,
      );
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${retryInSec}s.`,
      });
    }

    return next();
  });
}
