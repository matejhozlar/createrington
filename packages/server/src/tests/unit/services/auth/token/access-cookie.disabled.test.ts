import { describe, it, expect, vi, beforeEach } from "vitest";

// Same shape as access-cookie.service.test.ts but with COOKIE_DOMAIN unset,
// so we can verify the no-op behavior on dev / unconfigured deployments.
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false },
    app: {
      auth: {
        accessToken: { expiresIn: "15m", secret: "test-secret-32-chars-min-x" },
        refreshToken: { expiresInDays: 30 },
        cookie: {
          name: "crt_refresh",
          accessName: "crt_access",
          domain: undefined,
        },
      },
    },
  },
}));

import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import type { Response } from "express";

describe("AccessCookieService (COOKIE_DOMAIN unset)", () => {
  let res: Response;
  let cookie: ReturnType<typeof vi.fn>;
  let clearCookie: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookie = vi.fn();
    clearCookie = vi.fn();
    res = { cookie, clearCookie } as unknown as Response;
  });

  it("isEnabled returns false", () => {
    expect(accessCookieService.isEnabled()).toBe(false);
  });

  it("setCookie is a no-op", () => {
    accessCookieService.setCookie(res, "anything");
    expect(cookie).not.toHaveBeenCalled();
  });

  it("clearCookie is a no-op", () => {
    accessCookieService.clearCookie(res);
    expect(clearCookie).not.toHaveBeenCalled();
  });
});
