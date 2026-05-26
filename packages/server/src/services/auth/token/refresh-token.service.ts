import crypto from "node:crypto";
import config from "@/config";
import type { Request, Response } from "express";

/**
 * Generates, hashes, and ferries opaque refresh tokens between the database and the
 * httpOnly cookie scoped to `/api/auth`. Raw tokens are only ever held in transit:
 * everything persisted (and looked up against) is the SHA-256 hash. Singleton.
 */
class RefreshTokenService {
  private static instance: RefreshTokenService;

  private readonly expiresInDays: number;
  private readonly cookieName: string;
  private readonly cookieDomain: string | undefined;

  private constructor() {
    this.expiresInDays = config.app.auth.refreshToken.expiresInDays;
    this.cookieName = config.app.auth.cookie.name;
    this.cookieDomain = config.app.auth.cookie.domain;
  }

  static getInstance(): RefreshTokenService {
    if (!RefreshTokenService.instance) {
      RefreshTokenService.instance = new RefreshTokenService();
    }
    return RefreshTokenService.instance;
  }

  /**
   * Generates a fresh opaque refresh token.
   *
   * @returns An 80-character lowercase hex string (40 random bytes).
   */
  generate(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /** SHA-256 hash of a raw refresh token for storage / lookup. */
  hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /** Absolute expiry timestamp for a token issued now (uses the configured `expiresInDays`). */
  getExpiresAt(): Date {
    return new Date(Date.now() + this.expiresInDays * 86_400_000);
  }

  /**
   * Writes the refresh token to the response as an httpOnly cookie scoped to
   * `/api/auth`. When `COOKIE_DOMAIN` is set, also clears any leftover host-only
   * cookie of the same name first so cookie-parser cannot pick the stale value
   * and trip the rotation system's theft detection.
   */
  setCookie(res: Response, token: string): void {
    // Defensive clear of any leftover host-only cookie from before the
    // COOKIE_DOMAIN migration. Without this the browser can hold both a
    // host-only and a domain-scoped cookie under the same name; cookie-parser
    // picks one non-deterministically, and if it grabs the stale host-only
    // value the rotation system flags it as token theft and revokes the
    // user's whole token family. Once each user has logged in once after
    // this fix ships the legacy cookie is gone forever.
    if (this.cookieDomain) {
      res.clearCookie(this.cookieName, {
        httpOnly: true,
        secure: config.envMode.isProd,
        sameSite: "lax",
        path: "/api/auth",
      });
    }
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: this.expiresInDays * 86_400_000,
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
  }

  /**
   * Clears the refresh token cookie (both domain-scoped and legacy host-only
   * variants) using the same flags as `setCookie` so the browser actually
   * matches and removes them.
   */
  clearCookie(res: Response): void {
    if (this.cookieDomain) {
      res.clearCookie(this.cookieName, {
        httpOnly: true,
        secure: config.envMode.isProd,
        sameSite: "lax",
        path: "/api/auth",
      });
    }
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/api/auth",
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
  }

  /** Reads the raw refresh token from the request's cookies, or `undefined` if absent. */
  extractFromRequest(req: Request): string | undefined {
    return req.cookies?.[this.cookieName];
  }
}

export const refreshTokenService = RefreshTokenService.getInstance();
