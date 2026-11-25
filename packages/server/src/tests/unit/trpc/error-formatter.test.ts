import { describe, it, expect, vi } from "vitest";

const envMode = vi.hoisted(() => ({ isDev: false }));

vi.mock("@/config", () => ({
  default: {
    envMode,
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

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { publicProcedure, router } from "@/trpc/trpc";
import { coercedId, trpcError } from "@/trpc/utils";
import { NotFoundError } from "@/errors";
import { testContext } from "@/tests/helpers/trpc";
import { z } from "zod";

const appRouter = router({
  broken: publicProcedure.query(() => {
    throw new Error(
      'insert or update on table "player_ban" violates foreign key constraint "player_ban_player_fk"',
    );
  }),
  unavailable: publicProcedure.query(() => {
    throw trpcError.internal("Ghost member service is not available");
  }),
  missing: publicProcedure.query(() => {
    throw new NotFoundError("Player not found");
  }),
  count: publicProcedure
    .input(z.object({ serverId: coercedId().optional() }))
    .query(({ input }) => input.serverId ?? null),
});

async function messageOf(path: string, input?: unknown): Promise<string> {
  const query =
    input === undefined
      ? ""
      : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://localhost/trpc/${path}${query}`),
    router: appRouter,
    createContext: () => testContext(),
  });
  const body = (await response.json()) as { error: { message: string } };
  return body.error.message;
}

describe("tRPC error messages sent to the caller", () => {
  it("replaces the message of an unexpected failure outside dev", async () => {
    expect(await messageOf("broken")).toBe(
      "Something went wrong on our side. Please try again.",
    );
  });

  it("keeps the message of an internal error a router raised on purpose", async () => {
    expect(await messageOf("unavailable")).toBe(
      "Ghost member service is not available",
    );
  });

  it("keeps the message of a mapped domain error", async () => {
    expect(await messageOf("missing")).toBe("Player not found");
  });

  it("keeps the raw message in dev", async () => {
    envMode.isDev = true;
    try {
      expect(await messageOf("broken")).toContain("player_ban_player_fk");
    } finally {
      envMode.isDev = false;
    }
  });

  it("rejects an id past the int4 range as bad input instead of reaching the database", async () => {
    expect(await messageOf("count", { serverId: 99999999999 })).toContain(
      "serverId",
    );
  });
});
