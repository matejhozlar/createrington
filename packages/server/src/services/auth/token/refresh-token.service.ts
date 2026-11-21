import crypto from "node:crypto";
import config from "@/config";
import type { Request, Response } from "express";
import { baseCookieOptions } from "./cookie-options";

const COOKIE_PATH = "/api/auth";

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

  /** Generates a fresh opaque refresh token. */
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
    this.clearHostOnlyCookie(res);
    res.cookie(this.cookieName, token, {
      ...this.cookieOptions(),
      maxAge: this.expiresInDays * 86_400_000,
    });
  }

  /**
   * Clears the refresh token cookie (both domain-scoped and legacy host-only
   * variants) using the same flags as `setCookie` so the browser actually
   * matches and removes them.
   */
  clearCookie(res: Response): void {
    this.clearHostOnlyCookie(res);
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  /** Reads the raw refresh token from the request's cookies, or `undefined` if absent. */
  extractFromRequest(req: Request): string | undefined {
    const value: unknown = req.cookies?.[this.cookieName];
    return typeof value === "string" ? value : undefined;
  }

  private cookieOptions() {
    return {
      ...baseCookieOptions(COOKIE_PATH),
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    };
  }

  private clearHostOnlyCookie(res: Response): void {
    if (this.cookieDomain) {
      res.clearCookie(this.cookieName, baseCookieOptions(COOKIE_PATH));
    }
  }
}

export const refreshTokenService = RefreshTokenService.getInstance();
