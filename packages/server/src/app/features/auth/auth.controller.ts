import { AuthRole, discordOAuth } from "@/services/discord/oauth/oauth.service";
import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/app/middleware";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import { sessionService } from "@/services/auth/session/session.service";
import { Q } from "@/db";
import type { JWTPayload } from "@createrington/shared/auth";
import crypto from "node:crypto";

/** In-memory store for OAuth state tokens (state → expiry timestamp) */
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Authentication controller
 *
 * Handles Discord OAuth flow, dual-token management (access + refresh),
 * and session lifecycle.
 */
export class AuthController {
  /**
   * GET /api/auth/discord
   *
   * Returns Discord OAuth authorization URL
   */
  static async getAuthUrl(req: Request, res: Response): Promise<void> {
    const state = crypto.randomBytes(32).toString("hex");

    // Store state server-side with expiry
    pendingStates.set(state, Date.now() + STATE_TTL_MS);

    // Cleanup expired states
    for (const [key, expiry] of pendingStates) {
      if (expiry < Date.now()) pendingStates.delete(key);
    }

    const authUrl = discordOAuth.generateAuthUrl(state);

    res.json({
      success: true,
      data: {
        url: authUrl,
        state,
      },
    });
  }

  /**
   * POST /api/auth/discord/callback
   * Body: { code: string, state?: string }
   *
   * Handles Discord OAuth callback.
   * Returns short-lived access token in body + sets refresh token as httpOnly cookie.
   */
  static async handleDiscordCallback(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { code, state } = req.body;

    if (!code) {
      throw new BadRequestError("Authorization code is required");
    }

    // Validate CSRF state parameter
    if (!state || !pendingStates.has(state)) {
      throw new BadRequestError("Invalid or expired state parameter");
    }
    const expiry = pendingStates.get(state)!;
    pendingStates.delete(state); // One-time use
    if (expiry < Date.now()) {
      throw new BadRequestError("Invalid or expired state parameter");
    }

    try {
      const user = await discordOAuth.authenticate(code);

      if (user.role === AuthRole.UNVERIFIED) {
        logger.warn(
          `Unverified user ${user.username} (${user.discordId}) attempted to login`,
        );
        throw new UnauthorizedError(
          "You are not registered. Please contact an administrator.",
        );
      }

      // Generate short-lived access token
      const accessToken = jwtService.generate(user);

      // Create server-side session and get raw refresh token
      const rawRefreshToken = await sessionService.createSession({
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        ip: req.clientIp || req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Set refresh token as httpOnly cookie
      refreshTokenService.setCookie(res, rawRefreshToken);

      logger.info(
        `User ${user.username} (${user.discordId}) logged in successfully`,
      );

      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            discordId: user.discordId,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            isAdmin: user.isAdmin,
            minecraftUuid: user.minecraftUuid,
            minecraftUsername: user.minecraftUsername,
          },
        },
        message: "Authentication successful",
      });
    } catch (error) {
      logger.error("Discord OAuth callback failed:", error);

      if (error instanceof UnauthorizedError) {
        throw error;
      }

      throw new UnauthorizedError("Authentication failed");
    }
  }

  /**
   * POST /api/auth/refresh
   *
   * Rotate refresh token (cookie-based, no Bearer needed).
   * Returns new access token + sets new refresh cookie.
   * Re-fetches user data from DB for fresh role info.
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    const rawToken = refreshTokenService.extractFromRequest(req);

    if (!rawToken) {
      throw new UnauthorizedError("No refresh token");
    }

    const result = await sessionService.rotateToken(
      rawToken,
      req.clientIp || req.ip,
      req.headers["user-agent"],
    );

    if (!result) {
      refreshTokenService.clearCookie(res);
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Re-fetch fresh user data from DB
    const player = await Q.player.get({ discordId: result.discordId });
    const isAdmin = await Q.admin.exists({ discordId: result.discordId });
    const role = isAdmin ? AuthRole.ADMIN : AuthRole.USER;

    const payload: JWTPayload = {
      discordId: result.discordId,
      username: result.discordUsername ?? player.minecraftUsername,
      avatar: result.discordAvatar ?? undefined,
      role,
      isAdmin,
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    };

    const accessToken = jwtService.generateFromPayload(payload);
    refreshTokenService.setCookie(res, result.rawToken);

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          discordId: payload.discordId,
          username: payload.username,
          avatar: payload.avatar,
          role: payload.role,
          isAdmin: payload.isAdmin,
          minecraftUuid: payload.minecraftUuid,
          minecraftUsername: payload.minecraftUsername,
        },
      },
    });
  }

  /**
   * GET /api/auth/me
   *
   * Returns current user information from JWT
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }

  /**
   * POST /api/auth/logout
   *
   * Revoke session via cookie + clear cookie.
   * Public route — works even without a valid Bearer token.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    const rawToken = refreshTokenService.extractFromRequest(req);

    if (rawToken) {
      await sessionService.revokeByToken(rawToken);
    }

    refreshTokenService.clearCookie(res);

    logger.info(`User ${req.user?.username || "Unknown"} logged out`);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }

  /**
   * POST /api/auth/logout-all
   *
   * Revoke all sessions for the authenticated user.
   * Requires valid Bearer token (user auth).
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    await sessionService.revokeAllForUser(req.user.discordId);
    refreshTokenService.clearCookie(res);

    logger.info(
      `User ${req.user.username} (${req.user.discordId}) logged out of all sessions`,
    );

    res.json({
      success: true,
      message: "All sessions revoked",
    });
  }

  /**
   * GET /api/auth/status
   *
   * Check authentication status
   */
  static async checkStatus(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        authenticated: !!req.user,
        user: req.user || null,
      },
    });
  }
}
