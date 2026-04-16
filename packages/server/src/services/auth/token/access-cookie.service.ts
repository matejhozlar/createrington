import config from "@/config";
import type { Request, Response } from "express";

/**
 * Access Token Cookie Service
 *
 * Sets and clears the short-lived access token as an httpOnly cookie scoped
 * to the configured `COOKIE_DOMAIN`. Used to expose the access token to
 * cross-subdomain consumers (e.g. the sandbox panel) without forcing them to
 * implement their own token storage.
 *
 * Coexists with the existing Bearer-header pattern — both transports verify
 * the same JWT, so existing first-party clients are unaffected.
 */
class AccessCookieService {
  private static instance: AccessCookieService;

  private readonly cookieName: string;
  private readonly cookieDomain: string | undefined;
  private readonly maxAgeMs: number;

  private constructor() {
    this.cookieName = config.app.auth.cookie.accessName;
    this.cookieDomain = config.app.auth.cookie.domain;
    this.maxAgeMs = parseExpiresIn(config.app.auth.accessToken.expiresIn);
  }

  static getInstance(): AccessCookieService {
    if (!AccessCookieService.instance) {
      AccessCookieService.instance = new AccessCookieService();
    }
    return AccessCookieService.instance;
  }

  /** True when COOKIE_DOMAIN is configured — the cookie is only useful to cross-subdomain consumers */
  isEnabled(): boolean {
    return !!this.cookieDomain;
  }

  /**
   * Set the access token as an httpOnly cookie with the same expiry as the
   * underlying JWT. No-op when COOKIE_DOMAIN is unset — the cookie is
   * meaningless without a parent domain for cross-subdomain consumers.
   *
   * Defensively clears any leftover host-only cookie of the same name before
   * setting the domain-scoped one. Without this the browser can hold both,
   * and cookie-parser may pick the stale host-only value, which silently
   * fails JWT verification and looks like a logged-out user.
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
   * Clear the access cookie. Must use the same path/domain/security flags
   * as `setCookie` so the browser matches and removes the existing cookie.
   * No-op when COOKIE_DOMAIN is unset (no cookie was ever set).
   *
   * Also clears any legacy host-only variant for the same reason as in
   * `setCookie` — true logout means both shapes go away.
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

  /** Read the raw access token from incoming request cookies. */
  extractFromRequest(req: Request): string | undefined {
    return req.cookies?.[this.cookieName];
  }
}

/**
 * Parse a JWT-style duration string (`15m`, `24h`, `7d`, `60s`) into
 * milliseconds. The same format is enforced by the env schema.
 */
export function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid access token expiry: "${value}" (expected number + s/m/h/d)`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

export const accessCookieService = AccessCookieService.getInstance();
