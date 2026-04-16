import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config so the singleton constructs deterministically.
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: true },
    app: {
      auth: {
        accessToken: { expiresIn: "15m", secret: "test-secret-32-chars-min-x" },
        cookie: {
          name: "crt_refresh",
          accessName: "crt_access",
          domain: ".create-rington.com",
        },
      },
    },
  },
}));

import {
  accessCookieService,
  parseExpiresIn,
} from "@/services/auth/token/access-cookie.service";
import type { Request, Response } from "express";

describe("parseExpiresIn", () => {
  it("converts seconds", () => {
    expect(parseExpiresIn("60s")).toBe(60_000);
  });

  it("converts minutes", () => {
    expect(parseExpiresIn("15m")).toBe(15 * 60_000);
  });

  it("converts hours", () => {
    expect(parseExpiresIn("24h")).toBe(24 * 3_600_000);
  });

  it("converts days", () => {
    expect(parseExpiresIn("7d")).toBe(7 * 86_400_000);
  });

  it("throws for malformed input", () => {
    expect(() => parseExpiresIn("15")).toThrow();
    expect(() => parseExpiresIn("forever")).toThrow();
    expect(() => parseExpiresIn("15x")).toThrow();
  });
});

describe("AccessCookieService", () => {
  let cookieCalls: Array<[string, string, Record<string, unknown>]>;
  let clearCalls: Array<[string, Record<string, unknown>]>;
  let res: Response;

  beforeEach(() => {
    cookieCalls = [];
    clearCalls = [];
    res = {
      cookie: vi.fn(
        (name: string, value: string, opts: Record<string, unknown>) => {
          cookieCalls.push([name, value, opts]);
          return res;
        },
      ),
      clearCookie: vi.fn((name: string, opts: Record<string, unknown>) => {
        clearCalls.push([name, opts]);
        return res;
      }),
    } as unknown as Response;
  });

  describe("setCookie", () => {
    it("sets the cookie with the configured name and value", () => {
      accessCookieService.setCookie(res, "the-token");
      expect(cookieCalls).toHaveLength(1);
      const [name, value] = cookieCalls[0];
      expect(name).toBe("crt_access");
      expect(value).toBe("the-token");
    });

    it("uses httpOnly + sameSite=lax + secure (in prod) + path=/", () => {
      accessCookieService.setCookie(res, "x");
      const opts = cookieCalls[0][2];
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe("lax");
      expect(opts.secure).toBe(true);
      expect(opts.path).toBe("/");
    });

    it("scopes the cookie to the configured domain", () => {
      accessCookieService.setCookie(res, "x");
      expect(cookieCalls[0][2].domain).toBe(".create-rington.com");
    });

    it("uses maxAge matching JWT_ACCESS_EXPIRES_IN (15m → 900_000ms)", () => {
      accessCookieService.setCookie(res, "x");
      expect(cookieCalls[0][2].maxAge).toBe(15 * 60_000);
    });
  });

  describe("clearCookie", () => {
    it("clears the cookie with matching name, path, and domain", () => {
      accessCookieService.clearCookie(res);
      expect(clearCalls).toHaveLength(1);
      const [name, opts] = clearCalls[0];
      expect(name).toBe("crt_access");
      expect(opts.path).toBe("/");
      expect(opts.domain).toBe(".create-rington.com");
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe("lax");
    });
  });

  describe("extractFromRequest", () => {
    it("returns the cookie value when present", () => {
      const req = { cookies: { crt_access: "abc" } } as unknown as Request;
      expect(accessCookieService.extractFromRequest(req)).toBe("abc");
    });

    it("returns undefined when missing", () => {
      const req = { cookies: {} } as unknown as Request;
      expect(accessCookieService.extractFromRequest(req)).toBeUndefined();
    });

    it("returns undefined when cookies object itself is missing", () => {
      const req = {} as unknown as Request;
      expect(accessCookieService.extractFromRequest(req)).toBeUndefined();
    });
  });

  describe("isEnabled", () => {
    it("returns true when COOKIE_DOMAIN is configured", () => {
      expect(accessCookieService.isEnabled()).toBe(true);
    });
  });
});
