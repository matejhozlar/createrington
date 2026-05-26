import config from "@/config";
import type { Request, Response } from "express";

/**
 * Sets and clears the short-lived access token as an httpOnly cookie scoped to the
 * configured `COOKIE_DOMAIN`, so cross-subdomain consumers (e.g. the sandbox panel)
 * can pick up the JWT without storing it themselves. All methods are a no-op when
 * `COOKIE_DOMAIN` is unset; the Bearer-header transport keeps working in parallel.
 */
class AccessCookieService {
  private static instance: AccessCookieService;

  private readonly cookieName: string;
  private readonly cookieDomain: string | undefined;
  private readonly maxAgeMs: number;

  private constructor() {
    this.cookieName = config.app.auth.cookie.accessName;
    this.cookieDomain = config.app.auth.cookie.domain;
    // Cookie lifetime tracks the refresh token, not the JWT. The cookie is a
    // transport for the JWT, the server still rejects expired JWTs inside
    // (which surfaces as a 401 and triggers the client refresh round-trip).
    // Matching the JWT's 15m expiry would mean the browser deletes the
    // cookie before the refresh request can carry it, locking SSO consumers
    // out of /auth/me even though their refresh token is still valid.
    this.maxAgeMs = config.app.auth.refreshToken.expiresInDays * 86_400_000;
  }

  static getInstance(): AccessCookieService {
    if (!AccessCookieService.instance) {
      AccessCookieService.instance = new AccessCookieService();
    }
    return AccessCookieService.instance;
  }

  /** True when `COOKIE_DOMAIN` is set; the cookie is otherwise pointless. */
  isEnabled(): boolean {
    return !!this.cookieDomain;
  }

  /**
   * Sets the access token as a domain-scoped httpOnly cookie. No-op when
   * `COOKIE_DOMAIN` is unset. Defensively clears any host-only cookie of the
   * same name first: if both shapes coexist, cookie-parser may pick the stale
   * one and the user looks logged out.
   */
  setCookie(res: Response, token: string): void {
    if (!this.cookieDomain) return;
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/",
    });
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/",
      maxAge: this.maxAgeMs,
      domain: this.cookieDomain,
    });
  }

  /**
   * Clears the access cookie (both domain-scoped and legacy host-only variants)
   * using the same flags as `setCookie` so the browser actually matches them.
   * No-op when `COOKIE_DOMAIN` is unset.
   */
  clearCookie(res: Response): void {
    if (!this.cookieDomain) return;
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/",
    });
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/",
      domain: this.cookieDomain,
    });
  }

  /** Reads the raw access token from the request's cookies, or `undefined` if absent. */
  extractFromRequest(req: Request): string | undefined {
    return req.cookies?.[this.cookieName];
  }
}

export const accessCookieService = AccessCookieService.getInstance();
