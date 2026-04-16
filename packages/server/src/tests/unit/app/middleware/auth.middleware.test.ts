import { describe, it, expect, vi, beforeEach } from "vitest";

// auth.middleware imports `AuthRole` from oauth.service, which transitively
// imports @/db — and @/db calls process.exit(1) at module load when it
// can't reach Postgres (e.g. in CI). Mock the OAuth service so the import
// chain stops at a no-op stub and never touches the DB.
vi.mock("@/services/discord/oauth/oauth.service", () => ({
  AuthRole: { ADMIN: "admin", USER: "user", UNVERIFIED: "unverified" },
}));

// jwtService.verify is the only thing we need from the JWT service.
vi.mock("@/services/auth/jwt", () => ({
  jwtService: {
    verify: vi.fn((token: string) => {
      if (token === "good") {
        return {
          discordId: "123",
          username: "alice",
          role: "user",
          isAdmin: false,
          minecraftUuid: "u",
          minecraftUsername: "Alice",
        };
      }
      throw new Error("Invalid token");
    }),
  },
}));

// accessCookieService.extractFromRequest is what the middleware calls when
// the Authorization header is missing.
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: {
    extractFromRequest: vi.fn(
      (req: { cookies?: Record<string, string> }) => req.cookies?.crt_access,
    ),
  },
}));

import { authenticate, optionalAuth } from "@/app/middleware/auth.middleware";
import type { Request, Response, NextFunction } from "express";

function makeReq(opts: { header?: string; cookie?: string }): Request {
  return {
    headers: opts.header ? { authorization: opts.header } : {},
    cookies: opts.cookie ? { crt_access: opts.cookie } : {},
  } as unknown as Request;
}

describe("authenticate", () => {
  let next: NextFunction;
  let nextErrors: unknown[];

  beforeEach(() => {
    nextErrors = [];
    next = vi.fn((err?: unknown) => {
      if (err) nextErrors.push(err);
    });
  });

  it("uses the Bearer header when present", async () => {
    const req = makeReq({ header: "Bearer good" });
    await authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user?.username).toBe("alice");
  });

  it("falls back to the access cookie when no header is present", async () => {
    const req = makeReq({ cookie: "good" });
    await authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user?.username).toBe("alice");
  });

  it("prefers the header over the cookie when both are present", async () => {
    const req = makeReq({ header: "Bearer good", cookie: "ignored" });
    await authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user).toBeDefined();
  });

  it("rejects when neither header nor cookie is present", async () => {
    await authenticate(makeReq({}), {} as Response, next);
    expect(nextErrors).toHaveLength(1);
    expect((nextErrors[0] as Error).message).toMatch(/Authentication required/);
  });

  it("rejects an invalid token", async () => {
    await authenticate(makeReq({ header: "Bearer bad" }), {} as Response, next);
    expect(nextErrors).toHaveLength(1);
    expect((nextErrors[0] as Error).message).toMatch(
      /Invalid or expired token/,
    );
  });
});

describe("optionalAuth", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("attaches user when a valid header token is present", async () => {
    const req = makeReq({ header: "Bearer good" });
    await optionalAuth(req, {} as Response, next);
    expect(req.user?.username).toBe("alice");
    expect(next).toHaveBeenCalledWith();
  });

  it("attaches user when a valid cookie token is present", async () => {
    const req = makeReq({ cookie: "good" });
    await optionalAuth(req, {} as Response, next);
    expect(req.user?.username).toBe("alice");
  });

  it("does not throw when no token is present", async () => {
    const req = makeReq({});
    await optionalAuth(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("silently skips when the token is invalid", async () => {
    const req = makeReq({ cookie: "bad" });
    await optionalAuth(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});
