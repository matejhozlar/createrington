import { describe, it, expect, vi, beforeEach } from "vitest";

const { isAdmin } = vi.hoisted(() => ({ isAdmin: vi.fn() }));

vi.mock("@/db", () => {
  const deep = (): unknown =>
    new Proxy(function () {}, {
      get: (_target, prop) => (prop === "then" ? undefined : deep()),
      apply: () => Promise.resolve(deep()),
    });
  return {
    Q: deep(),
    R: deep(),
    db: deep(),
    pool: deep(),
    balanceRepo: deep(),
  };
});

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  const { app } = actual.default;
  return {
    ...actual,
    default: {
      ...actual.default,
      app: {
        ...app,
        auth: {
          ...app.auth,
          accessToken: {
            ...app.auth.accessToken,
            secret: "test-access-secret",
          },
        },
      },
    },
  };
});

vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin },
}));

import { TRPCError } from "@trpc/server";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";
import { adminRouter } from "@/trpc/routers/admin";
import type { Context } from "@/trpc/context";

type Callable = (input?: unknown) => Promise<unknown>;

const PROCEDURE_PATHS = Object.keys(adminRouter._def.procedures);

function user(overrides: Partial<JWTPayload>): JWTPayload {
  return {
    discordId: "100000000000000001",
    username: "steve",
    role: AuthRole.USER,
    isAdmin: false,
    minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    minecraftUsername: "Steve",
    ...overrides,
  };
}

const CALLERS = [
  {
    who: "a signed-out visitor",
    user: null,
    code: "UNAUTHORIZED",
    message: "Authentication required",
  },
  {
    who: "an unverified account",
    user: user({ role: AuthRole.UNVERIFIED }),
    code: "FORBIDDEN",
    message: "Account verification required",
  },
  {
    who: "a verified player",
    user: user({}),
    code: "FORBIDDEN",
    message: "Admin access required",
  },
  {
    who: "a former admin whose JWT still says admin",
    user: user({ role: AuthRole.ADMIN, isAdmin: true }),
    code: "FORBIDDEN",
    message: "Admin access required",
  },
] as const;

function procedureAt(user: JWTPayload | null, path: string): Callable {
  const caller: unknown = adminRouter.createCaller({
    user,
    service: null,
    ip: "127.0.0.1",
  } satisfies Context);
  return path
    .split(".")
    .reduce(
      (node, key) => (node as Record<string, unknown>)[key],
      caller,
    ) as Callable;
}

async function rejection(call: Promise<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  return undefined;
}

beforeEach(() => {
  isAdmin.mockReset().mockResolvedValue(false);
});

it("walks the whole admin router", () => {
  expect(PROCEDURE_PATHS).toEqual(
    expect.arrayContaining([
      "refetchDiscordEntities",
      "players.bans.issueTemporary",
      "players.balance.adjust",
      "servers.toggleMaintenance",
    ]),
  );
});

describe.each(CALLERS)("as $who", ({ user, code, message }) => {
  it.each(PROCEDURE_PATHS)("admin.%s is refused", async (path) => {
    const error = await rejection(procedureAt(user, path)(undefined));

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code, message });
  });
});

it("checks the database before trusting an admin flag in the JWT", async () => {
  const formerAdmin = user({ role: AuthRole.ADMIN, isAdmin: true });

  await rejection(procedureAt(formerAdmin, "refetchDiscordEntities")());

  expect(isAdmin).toHaveBeenCalledWith(formerAdmin.discordId);
});
