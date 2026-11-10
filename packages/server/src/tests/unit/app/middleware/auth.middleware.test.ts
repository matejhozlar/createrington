import { describe, it, expect, vi, beforeEach } from "vitest";

// The middleware pulls in `@/db` transitively: error-handler imports
// DatabaseError from @/db/utils → @/db. @/db calls
// `await pool.query("SELECT 1")` at module load and process.exit(1)s on
// failure: fine locally, lethal in CI where there's no Postgres. Mock it at
// the boundary so the test never reaches the DB.
vi.mock("@/db", () => ({}));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
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
// the Authorization header is missing. isEnabled() gates the fallback so
// disabled deployments never accept attacker-supplied cookies.
// vi.hoisted runs before vi.mock factories so we can share these mocks
// with the test bodies below.
const { extractFromRequestMock, isEnabledMock } = vi.hoisted(() => ({
  extractFromRequestMock: vi.fn(
    (req: { cookies?: Record<string, string> }) => req.cookies?.crt_access,
  ),
  isEnabledMock: vi.fn(() => true),
}));
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: {
    extractFromRequest: extractFromRequestMock,
    isEnabled: isEnabledMock,
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
    isEnabledMock.mockReturnValue(true);
    extractFromRequestMock.mockClear();
  });

  it("uses the Bearer header when present", () => {
    const req = makeReq({ header: "Bearer good" });
    authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user?.username).toBe("alice");
  });

  it("falls back to the access cookie when no header is present", () => {
    const req = makeReq({ cookie: "good" });
    authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user?.username).toBe("alice");
  });

  it("prefers the header over the cookie when both are present", () => {
    const req = makeReq({ header: "Bearer good", cookie: "ignored" });
    authenticate(req, {} as Response, next);
    expect(nextErrors).toHaveLength(0);
    expect(req.user).toBeDefined();
  });

  it("rejects when neither header nor cookie is present", () => {
    authenticate(makeReq({}), {} as Response, next);
    expect(nextErrors).toHaveLength(1);
    expect((nextErrors[0] as Error).message).toMatch(/Authentication required/);
  });

  it("rejects an invalid token", () => {
    authenticate(makeReq({ header: "Bearer bad" }), {} as Response, next);
    expect(nextErrors).toHaveLength(1);
    expect((nextErrors[0] as Error).message).toMatch(
      /Invalid or expired token/,
    );
  });

  describe("when access cookie is disabled (no COOKIE_DOMAIN)", () => {
    beforeEach(() => {
      isEnabledMock.mockReturnValue(false);
    });

    it("does not consult the cookie even when one is present", () => {
      authenticate(makeReq({ cookie: "good" }), {} as Response, next);
      expect(extractFromRequestMock).not.toHaveBeenCalled();
      // No header, cookie ignored → unauthorized
      expect(nextErrors).toHaveLength(1);
      expect((nextErrors[0] as Error).message).toMatch(
        /Authentication required/,
      );
    });

    it("still accepts the Bearer header", () => {
      const req = makeReq({ header: "Bearer good" });
      authenticate(req, {} as Response, next);
      expect(nextErrors).toHaveLength(0);
      expect(req.user?.username).toBe("alice");
    });
  });
});

describe("optionalAuth", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    isEnabledMock.mockReturnValue(true);
    extractFromRequestMock.mockClear();
  });

  it("attaches user when a valid header token is present", () => {
    const req = makeReq({ header: "Bearer good" });
    optionalAuth(req, {} as Response, next);
    expect(req.user?.username).toBe("alice");
    expect(next).toHaveBeenCalledWith();
  });

  it("attaches user when a valid cookie token is present", () => {
    const req = makeReq({ cookie: "good" });
    optionalAuth(req, {} as Response, next);
    expect(req.user?.username).toBe("alice");
  });

  it("does not throw when no token is present", () => {
    const req = makeReq({});
    optionalAuth(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("silently skips when the token is invalid", () => {
    const req = makeReq({ cookie: "bad" });
    optionalAuth(req, {} as Response, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});
