import crypto from "node:crypto";
import config from "@/config";
import type { Request, Response } from "express";

/**
 * Refresh token service
 *
 * Handles opaque refresh token generation, hashing, and cookie management.
 * Refresh tokens are stored as SHA-256 hashes in the database and sent
 * as httpOnly cookies to the client.
 */
class RefreshTokenService {
  private static instance: RefreshTokenService;

  private readonly expiresInDays: number;
  private readonly cookieName: string;

  private constructor() {
    this.expiresInDays = config.app.auth.refreshToken.expiresInDays;
    this.cookieName = config.app.auth.cookie.name;
  }

  static getInstance(): RefreshTokenService {
    if (!RefreshTokenService.instance) {
      RefreshTokenService.instance = new RefreshTokenService();
    }
    return RefreshTokenService.instance;
  }

  /**
   * Generate a cryptographically random opaque refresh token (80-char hex)
   */
  generate(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Hash a raw refresh token with SHA-256 for database storage
   */
  hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Calculate the expiration date for a new refresh token
   */
  getExpiresAt(): Date {
    return new Date(Date.now() + this.expiresInDays * 86_400_000);
  }

  /**
   * Set the refresh token as an httpOnly cookie on the response
   */
  setCookie(res: Response, token: string): void {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: this.expiresInDays * 86_400_000,
    });
  }

  /**
   * Clear the refresh token cookie
   */
  clearCookie(res: Response): void {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: config.envMode.isProd,
      sameSite: "lax",
      path: "/api/auth",
    });
  }

  /**
   * Extract the refresh token from the request cookies
   */
  extractFromRequest(req: Request): string | undefined {
    return req.cookies?.[this.cookieName];
  }
}

export const refreshTokenService = RefreshTokenService.getInstance();
