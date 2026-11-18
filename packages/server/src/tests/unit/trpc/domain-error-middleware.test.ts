import { describe, it, expect, vi } from "vitest";

vi.mock("@/config", () => ({
  default: {
    envMode: { isDev: false },
    launcher: { available: true },
    app: { auth: { owner: { discordId: "1" } } },
  },
}));
vi.mock("@/http-logger", () => ({
  httpLogger: { info: vi.fn() },
  colorDuration: (ms: number) => `${ms}ms`,
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));

import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, router } from "@/trpc/trpc";
import { ConflictError, NotFoundError } from "@/errors";
import { NotFoundError as DbNotFoundError } from "@/db/utils/errors";
import { adminContext, testContext } from "@/tests/helpers/trpc";

const appRouter = router({
  missingPlayer: publicProcedure.query(() => {
    throw new NotFoundError("Player not found");
  }),
  missingRow: publicProcedure.query(() => {
    throw new DbNotFoundError("Player", { id: 7 });
  }),
  taken: adminProcedure.mutation(async () => {
    throw new ConflictError("Name already taken");
  }),
  broken: publicProcedure.query(() => {
    throw new Error("kaboom");
  }),
});

const publicCaller = appRouter.createCaller(testContext());
const adminCaller = appRouter.createCaller(adminContext());

async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected the call to be rejected");
}

describe("domain errors thrown from a procedure", () => {
  it("answers NOT_FOUND for an AppError NotFoundError without a wrapper", async () => {
    const error = await rejection(publicCaller.missingPlayer());

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Player not found");
    expect(error.cause).toBeInstanceOf(NotFoundError);
  });

  it("answers NOT_FOUND for a missing database row", async () => {
    const error = await rejection(publicCaller.missingRow());

    expect(error.code).toBe("NOT_FOUND");
    expect(error.cause).toBeInstanceOf(DbNotFoundError);
  });

  it("maps errors on procedures behind the auth middlewares too", async () => {
    const error = await rejection(adminCaller.taken());

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("Name already taken");
  });

  it("keeps an unknown error internal", async () => {
    const error = await rejection(publicCaller.broken());

    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
