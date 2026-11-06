import { describe, it, expect, vi, beforeEach } from "vitest";

// Dev deployment scenario: COOKIE_DOMAIN is set AND the deployment is the
// dev one (e.g. dev.createrington.com), so deriveCookieName suffixes the
// configured access name with `_dev`. Prod keeps the legacy unsuffixed
// name so external SSO consumers don't break, see access-cookie.service.test.ts.
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: true, isDevDeployment: true },
    app: {
      auth: {
        accessToken: { expiresIn: "15m", secret: "test-secret-32-chars-min-x" },
        refreshToken: { expiresInDays: 30 },
        cookie: {
          name: "crt_refresh_dev",
          accessName: "crt_access_dev",
          domain: ".createrington.com",
        },
      },
    },
  },
}));

import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import type { Request, Response } from "express";

describe("AccessCookieService (dev-deployment suffixed name)", () => {
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

  it("setCookie uses the dev-suffixed name", () => {
    accessCookieService.setCookie(res, "the-token");
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0][0]).toBe("crt_access_dev");
  });

  it("clearCookie targets the dev-suffixed name on both host-only and domain variants", () => {
    accessCookieService.clearCookie(res);
    expect(clearCalls).toHaveLength(2);
    expect(clearCalls[0][0]).toBe("crt_access_dev");
    expect(clearCalls[1][0]).toBe("crt_access_dev");
  });

  it("extractFromRequest reads the dev-suffixed cookie", () => {
    const req = { cookies: { crt_access_dev: "abc" } } as unknown as Request;
    expect(accessCookieService.extractFromRequest(req)).toBe("abc");
  });

  it("does not read the legacy unsuffixed name on dev", () => {
    const req = { cookies: { crt_access: "legacy" } } as unknown as Request;
    expect(accessCookieService.extractFromRequest(req)).toBeUndefined();
  });
});
