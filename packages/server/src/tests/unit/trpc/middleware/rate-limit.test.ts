import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { Store } from "express-rate-limit";

const { createRateLimitStore } = vi.hoisted(() => ({
  createRateLimitStore: vi.fn<(name: string) => Store | undefined>(),
}));

vi.mock("@/services/rate-limit", () => ({ createRateLimitStore }));
vi.mock("@/db", () => ({}));

import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { publicProcedure, router } from "@/trpc/trpc";
import { testContext } from "@/tests/helpers/trpc";

function limitedRouter(name: string) {
  const limit = createRateLimit({
    name,
    limit: 2,
    windowMs: 60_000,
    key: (ctx) => ctx.ip,
  });
  return router({ ping: publicProcedure.use(limit).query(() => "pong") });
}

function callerFor(appRouter: ReturnType<typeof limitedRouter>, ip: string) {
  return appRouter.createCaller({ ...testContext(), ip });
}

beforeEach(() => {
  createRateLimitStore.mockReset();
});

describe("createRateLimit", () => {
  it("rejects the request after the limit with TOO_MANY_REQUESTS", async () => {
    createRateLimitStore.mockReturnValue(undefined);
    const caller = callerFor(limitedRouter("test.limit"), "10.0.0.1");

    await caller.ping();
    await caller.ping();
    const error = await caller.ping().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect((error as TRPCError).message).toMatch(
      /^Rate limit exceeded\. Try again in \d+s\.$/,
    );
  });

  it("counts every key separately", async () => {
    createRateLimitStore.mockReturnValue(undefined);
    const appRouter = limitedRouter("test.keys");

    await callerFor(appRouter, "10.0.0.1").ping();
    await callerFor(appRouter, "10.0.0.1").ping();

    await expect(callerFor(appRouter, "10.0.0.2").ping()).resolves.toBe("pong");
  });

  it("counts in the shared store under a trpc-prefixed name", async () => {
    const increment = vi.fn().mockResolvedValue({
      totalHits: 3,
      resetTime: new Date(Date.now() + 30_000),
    });
    const init = vi.fn();
    createRateLimitStore.mockReturnValue({
      init,
      increment,
      decrement: vi.fn(),
      resetKey: vi.fn(),
    });

    const caller = callerFor(limitedRouter("test.shared"), "10.0.0.3");
    const error = await caller.ping().catch((e: unknown) => e);

    expect(createRateLimitStore).toHaveBeenCalledWith("trpc:test.shared");
    expect(init).toHaveBeenCalledWith({ windowMs: 60_000 });
    expect(increment).toHaveBeenCalledWith("10.0.0.3");
    expect((error as TRPCError).message).toBe(
      "Rate limit exceeded. Try again in 30s.",
    );
  });
});
