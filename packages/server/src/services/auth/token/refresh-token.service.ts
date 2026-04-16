import crypto from "node:crypto";
import config from "@/config";
import type { Request, Response } from "express";

/**
 * Refresh Token Service
 *
 * Handles opaque refresh token generation, hashing, and cookie management:
 * - Generates cryptographically random tokens using Node's crypto module
 * - Hashes tokens with SHA-256 before database storage (raw token never persisted)
 * - Computes expiration dates based on the configured lifetime in days
 * - Sets and clears the httpOnly refresh token cookie on Express responses
 * - Extracts the token from incoming request cookies for rotation/logout flows
 *
 * NOTE: Tokens are always stored as SHA-256 hashes — only the raw token is
 * sent to the client once; subsequent lookups hash the cookie value before querying
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

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /** Returns the singleton instance, creating it on first call */
  static getInstance(): RefreshTokenService {
    if (!RefreshTokenService.instance) {
      RefreshTokenService.instance = new RefreshTokenService();
    }
    return RefreshTokenService.instance;
  }

  // ==========================================================================
  // TOKEN GENERATION
  // ==========================================================================

  /**
   * Generate a cryptographically random opaque refresh token
   *
   * @returns An 80-character lowercase hex string (40 random bytes)
   */
  generate(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Hash a raw refresh token with SHA-256 for database storage
   *
   * @param token - The raw refresh token to hash
   * @returns The hex-encoded SHA-256 digest
   */
  hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Calculate the expiration date for a new refresh token
   *
   * @returns A Date representing the moment the token should expire
   */
  getExpiresAt(): Date {
    return new Date(Date.now() + this.expiresInDays * 86_400_000);
  }

  // ==========================================================================
  // COOKIE MANAGEMENT
  // ==========================================================================

  /**
   * Set the refresh token as an httpOnly cookie on the response
   *
   * The cookie is scoped to `/api/auth`, marked `secure` in production,
   * and uses `SameSite=Lax` to balance CSRF protection with redirect flows.
   *
   * @param res - The Express response object to set the cookie on
   * @param token - The raw refresh token value to store in the cookie
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
   * Clear the refresh token cookie from the response
   *
   * Must use the same path and security flags as `setCookie` so the browser
   * matches and removes the existing cookie. Also clears any legacy
   * host-only cookie left over from before the COOKIE_DOMAIN migration so
   * logout truly logs the user out (otherwise the host-only cookie sticks
   * around and confuses subsequent requests).
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

  /**
   * Extract the refresh token from the incoming request cookies
   *
   * @param req - The Express request object to read cookies from
   * @returns The raw refresh token string, or undefined if the cookie is absent
   */
  extractFromRequest(req: Request): string | undefined {
    return req.cookies?.[this.cookieName];
  }
}

export const refreshTokenService = RefreshTokenService.getInstance();
