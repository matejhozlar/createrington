import { MemoryStore, type Options, type Store } from "express-rate-limit";
import { createRateLimitStore } from "@/services/rate-limit";
import { middleware } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import type { Context } from "@/trpc/context";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key: (ctx: Context) => string;
  name: string;
}

export function createRateLimit(opts: RateLimitOptions) {
  const store: Store =
    createRateLimitStore(`trpc:${opts.name}`) ?? new MemoryStore();
  void store.init?.({ windowMs: opts.windowMs } as Options);

  return middleware(async ({ ctx, next }) => {
    const key = opts.key(ctx);
    const { totalHits, resetTime } = await store.increment(key);

    if (totalHits > opts.limit) {
      const resetAt = resetTime?.getTime() ?? Date.now() + opts.windowMs;
      const retryInSec = Math.ceil((resetAt - Date.now()) / 1000);
      logger.warn(
        `[trpc rate-limit] ${opts.name} exceeded by ${key} (${totalHits}/${opts.limit})`,
      );
      throw trpcError.tooManyRequests(
        `Rate limit exceeded. Try again in ${retryInSec}s.`,
      );
    }

    return next();
  });
}
