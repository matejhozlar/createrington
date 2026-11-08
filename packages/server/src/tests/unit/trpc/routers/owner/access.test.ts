import { describe, it, expect, vi } from "vitest";

const { OWNER_ID } = vi.hoisted(() => ({ OWNER_ID: "100000000000000009" }));

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
          owner: { ...app.auth.owner, discordId: OWNER_ID },
        },
      },
    },
  };
});

import { TRPCError } from "@trpc/server";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";
import { ownerRouter } from "@/trpc/routers/owner";
import type { Context } from "@/trpc/context";

type Callable = (input?: unknown) => Promise<unknown>;

const PROCEDURE_PATHS = Object.keys(ownerRouter._def.procedures);

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
    who: "an unverified account using the owner's Discord ID",
    user: user({ discordId: OWNER_ID, role: AuthRole.UNVERIFIED }),
    code: "FORBIDDEN",
    message: "Account verification required",
  },
  {
    who: "a verified player",
    user: user({}),
    code: "FORBIDDEN",
    message: "Owner access required",
  },
  {
    who: "an admin who is not the owner",
    user: user({ role: AuthRole.ADMIN, isAdmin: true }),
    code: "FORBIDDEN",
    message: "Owner access required",
  },
] as const;

function procedureAt(user: JWTPayload | null, path: string): Callable {
  const caller: unknown = ownerRouter.createCaller({
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

it("walks the whole owner router", () => {
  expect(PROCEDURE_PATHS).toEqual(
    expect.arrayContaining([
      "admins.promote",
      "admins.demote",
      "donations.list",
      "launcherReleases.release",
    ]),
  );
});

describe.each(CALLERS)("as $who", ({ user, code, message }) => {
  it.each(PROCEDURE_PATHS)("owner.%s is refused", async (path) => {
    const error = await rejection(procedureAt(user, path)(undefined));

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code, message });
  });
});
