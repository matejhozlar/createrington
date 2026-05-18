import { describe, it, expect, vi, beforeEach } from "vitest";

// Prod deployment scenario: COOKIE_DOMAIN is set and the deployment is prod,
// so deriveCookieName returns the base name unchanged. The dev deployment
// adds a `_dev` suffix instead, see access-cookie.dev-suffix.test.ts.
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: true, isDevDeployment: false },
    app: {
      auth: {
        accessToken: { expiresIn: "15m", secret: "test-secret-32-chars-min-x" },
        refreshToken: { expiresInDays: 30 },
        cookie: {
          name: "crt_refresh",
          accessName: "crt_access",
          domain: ".createrington.com",
        },
      },
    },
  },
}));

import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import type { Request, Response } from "express";

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
      expect(cookieCalls[0][2].domain).toBe(".createrington.com");
    });

    it("uses maxAge matching the refresh token expiry, not the JWT expiry", () => {
      // The cookie has to outlive the JWT: when the JWT expires the server
      // returns 401 and the client refreshes, which requires the cookie to
      // still be present in the browser.
      accessCookieService.setCookie(res, "x");
      expect(cookieCalls[0][2].maxAge).toBe(30 * 86_400_000);
    });
  });

  describe("clearCookie", () => {
    it("clears both the host-only and domain-scoped variants", () => {
      // Two clears: host-only first (no domain), then domain-scoped. Together
      // they wipe any leftover legacy cookie from before the COOKIE_DOMAIN
      // migration plus the current domain-scoped cookie.
      accessCookieService.clearCookie(res);
      expect(clearCalls).toHaveLength(2);

      const [hostOnlyName, hostOnlyOpts] = clearCalls[0];
      expect(hostOnlyName).toBe("crt_access");
      expect(hostOnlyOpts.domain).toBeUndefined();
      expect(hostOnlyOpts.path).toBe("/");

      const [domainName, domainOpts] = clearCalls[1];
      expect(domainName).toBe("crt_access");
      expect(domainOpts.domain).toBe(".createrington.com");
      expect(domainOpts.path).toBe("/");
      expect(domainOpts.httpOnly).toBe(true);
      expect(domainOpts.sameSite).toBe("lax");
    });
  });

  describe("setCookie also clears the legacy host-only variant", () => {
    it("issues a host-only clearCookie before setting the new domain cookie", () => {
      accessCookieService.setCookie(res, "fresh-token");
      // Exactly one clear (host-only) and one set (domain-scoped)
      expect(clearCalls).toHaveLength(1);
      expect(clearCalls[0][1].domain).toBeUndefined();
      expect(cookieCalls).toHaveLength(1);
      expect(cookieCalls[0][2].domain).toBe(".createrington.com");
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
