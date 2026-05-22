import {
  AuthRole,
  discordOAuth,
  UnverifiedUserError,
} from "@/services/discord/oauth/oauth.service";
import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/app/middleware";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import { sessionService } from "@/services/auth/session/session.service";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { validateReturnTo } from "@/services/auth/sso/return-to";
import { verifyDevLoginToken } from "@/services/auth/dev-login/hmac";
import config from "@/config";
import { Q } from "@/db";
import type { JWTPayload } from "@createrington/shared/auth";
import crypto from "node:crypto";

function deriveRole(currentRole: AuthRole, isAdmin: boolean): AuthRole {
  if (currentRole === AuthRole.UNVERIFIED) return AuthRole.UNVERIFIED;
  return isAdmin ? AuthRole.ADMIN : AuthRole.USER;
}

/** In-memory store for OAuth state tokens (state → expiry timestamp) */
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory store for the server-driven SSO flow. Distinct from
 * `pendingStates` because each entry carries the validated return_to URL
 * so the callback knows where to send the user after the Discord round-trip.
 */
const pendingSsoStates = new Map<
  string,
  { expiry: number; returnTo: string }
>();

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

      const accessToken = jwtService.generate(user);

      const rawRefreshToken = await sessionService.createSession({
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        ip: req.clientIp || req.ip,
        userAgent: req.headers["user-agent"],
      });

      refreshTokenService.setCookie(res, rawRefreshToken);

      // Also expose the access token as a cross-subdomain cookie so SSO
      // consumers (e.g. sandbox.createrington.com) can read it without
      // implementing their own token storage. Existing first-party clients
      // continue to use the Bearer header from the JSON response below.
      accessCookieService.setCookie(res, accessToken);

      logger.info(`User ${user.discordId} logged in successfully`);

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
      if (error instanceof UnverifiedUserError) {
        logger.warn("Unverified user attempted to login");
        throw new UnauthorizedError(
          "You are not registered. Please apply to join before logging in.",
          { code: "UNVERIFIED" },
        );
      }

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
      accessCookieService.clearCookie(res);
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

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
    accessCookieService.setCookie(res, accessToken);

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

    const isAdmin = await adminStatusService.isAdmin(req.user.discordId);
    const role = deriveRole(req.user.role, isAdmin);

    res.json({
      success: true,
      data: {
        user: { ...req.user, isAdmin, role },
      },
    });
  }

  /**
   * POST /api/auth/logout
   *
   * Revoke session via cookie + clear cookie.
   * Public route, works even without a valid Bearer token.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    const rawToken = refreshTokenService.extractFromRequest(req);

    // Fall back to the session row when there's no Bearer token (the
    // client never sends one to /logout).
    let identity = req.user?.username;
    if (!identity && rawToken) {
      const session = await Q.auth.session.findByTokenHash(
        refreshTokenService.hash(rawToken),
      );
      identity = session?.discord_username ?? session?.discord_id ?? undefined;
    }

    if (rawToken) {
      await sessionService.revokeByToken(rawToken);
    }

    refreshTokenService.clearCookie(res);
    accessCookieService.clearCookie(res);

    logger.info(`User ${identity ?? "Unknown"} logged out`);

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
    accessCookieService.clearCookie(res);

    logger.info(`User ${req.user.discordId} logged out of all sessions`);

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
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const isAdmin = await adminStatusService.isAdmin(req.user.discordId);
    const role = deriveRole(req.user.role, isAdmin);

    res.json({
      success: true,
      data: {
        authenticated: true,
        user: { ...req.user, isAdmin, role },
      },
    });
  }

  /**
   * GET /api/auth/sso/start?return_to=<url>
   *
   * Server-driven SSO entry point for cross-subdomain consumers (e.g. the
   * sandbox panel). Validates `return_to` against the configured whitelist,
   * stores it server-side keyed by a fresh state token, and redirects the
   * browser to Discord's authorization page with the SSO callback URI.
   *
   * Distinct from /api/auth/discord because the existing flow expects the
   * client (main React app) to handle the redirect, that doesn't work
   * cross-origin, so this endpoint takes ownership of the entire round-trip.
   */
  static async ssoStart(req: Request, res: Response): Promise<void> {
    const callbackUrl = config.app.auth.sso.callbackUrl;
    if (!callbackUrl) {
      throw new BadRequestError("SSO is not configured on this server");
    }

    // Express parses repeated/nested query params as arrays/objects, so a
    // typeof check is the honest way to narrow the type. validateReturnTo
    // accepts undefined and rejects, so the explicit guard is for clarity.
    const rawReturnTo = req.query.return_to;
    const returnTo = validateReturnTo(
      typeof rawReturnTo === "string" ? rawReturnTo : undefined,
    );
    if (!returnTo) {
      throw new BadRequestError(
        "return_to is missing or not in the allowed list",
      );
    }

    const state = crypto.randomBytes(32).toString("hex");
    pendingSsoStates.set(state, {
      expiry: Date.now() + STATE_TTL_MS,
      returnTo,
    });

    // Cleanup expired SSO states opportunistically
    for (const [key, entry] of pendingSsoStates) {
      if (entry.expiry < Date.now()) pendingSsoStates.delete(key);
    }

    res.redirect(discordOAuth.generateAuthUrl(state, callbackUrl));
  }

  /**
   * GET /api/auth/sso/callback?code=<code>&state=<state>
   *
   * Server-side completion of the SSO flow. Validates state, exchanges the
   * Discord code, sets both cookies on the configured cookie domain, then
   * redirects the browser to the original `return_to`.
   *
   * Pre-entry validation failures (missing/invalid state) throw a JSON 400
   * because there's no validated return_to to redirect to. Once the state
   * resolves, post-entry failures (UNVERIFIED user, Discord call failure)
   * redirect back to the consumer with `?sso_error=...` so it can render
   * its own UI instead of stranding the user on a JSON blob.
   */
  static async ssoCallback(req: Request, res: Response): Promise<void> {
    const callbackUrl = config.app.auth.sso.callbackUrl;
    const rawCode = req.query.code;
    const rawState = req.query.state;
    const code = typeof rawCode === "string" ? rawCode : undefined;
    const state = typeof rawState === "string" ? rawState : undefined;

    if (!code || !state) {
      throw new BadRequestError("Missing code or state");
    }

    const entry = pendingSsoStates.get(state);
    if (!entry) {
      throw new BadRequestError("Invalid or expired state parameter");
    }
    pendingSsoStates.delete(state);
    if (entry.expiry < Date.now()) {
      throw new BadRequestError("Invalid or expired state parameter");
    }

    try {
      const user = await discordOAuth.authenticate(code, callbackUrl);

      const accessToken = jwtService.generate(user);
      const rawRefreshToken = await sessionService.createSession({
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        ip: req.clientIp || req.ip,
        userAgent: req.headers["user-agent"],
      });

      refreshTokenService.setCookie(res, rawRefreshToken);
      accessCookieService.setCookie(res, accessToken);

      logger.info(`User ${user.discordId} completed SSO to ${entry.returnTo}`);

      safeSsoRedirect(res, entry.returnTo);
    } catch (error) {
      if (error instanceof UnverifiedUserError) {
        logger.warn("Unverified user attempted SSO login");
        safeSsoRedirect(res, redirectWithError(entry.returnTo, "unverified"));
        return;
      }

      logger.error("SSO callback failed:", error);
      safeSsoRedirect(res, redirectWithError(entry.returnTo, "auth_failed"));
    }
  }

  /**
   * GET /api/auth/dev-set-refresh
   *
   * Dev-only helper used by `pnpm mint-session --open`. Sets the supplied
   * refresh token as the HttpOnly cookie (the way a real login would) and
   * redirects to an internal path so the AuthProvider picks it up. Route is
   * only mounted when NODE_ENV === "development" so this never ships to prod.
   */
  static async devSetRefresh(req: Request, res: Response): Promise<void> {
    if (!config.envMode.isDev) {
      throw new BadRequestError("Not available outside development");
    }

    const token =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const rawTs = typeof req.query.ts === "string" ? req.query.ts : undefined;
    const sig = typeof req.query.sig === "string" ? req.query.sig : undefined;
    if (!token || !rawTs || !sig) {
      throw new BadRequestError("Missing token, ts, or sig");
    }
    const ts = Number(rawTs);
    if (
      !verifyDevLoginToken(token, ts, sig, config.app.auth.accessToken.secret)
    ) {
      throw new BadRequestError("Invalid or expired signature");
    }

    const rawReturnTo =
      typeof req.query.return_to === "string" ? req.query.return_to : "/";

    refreshTokenService.setCookie(res, token);
    res.redirect(safeLocalPath(rawReturnTo));
  }
}

/**
 * Append `?sso_error=<reason>` to a return_to URL using URL parsing rather
 * than string concatenation, so URLs that already carry a query string or
 * fragment stay well-formed (e.g. `/page?foo=bar` becomes
 * `/page?foo=bar&sso_error=...` instead of `/page?foo=bar?sso_error=...`).
 *
 * The whitelist already guarantees the URL parses, so the `new URL()` call
 * is safe, but if it ever fails we fall back to the raw return_to to keep
 * users out of an error loop.
 */
function redirectWithError(returnTo: string, reason: string): string {
  try {
    const url = new URL(returnTo);
    url.searchParams.set("sso_error", reason);
    return url.toString();
  } catch {
    return returnTo;
  }
}

/**
 * Revalidates the redirect target against the SSO whitelist before sending
 * the response. The URL was already validated when the SSO flow was
 * initiated (via `validateReturnTo` in `ssoStart`), so this is pure
 * defense-in-depth: it protects against any future path that lets an
 * unvalidated URL into `pendingSsoStates`, and it gives static-analysis
 * tools an explicit sanitizer on every `res.redirect` call site, closing
 * out CWE-601 warnings.
 */
function safeSsoRedirect(res: Response, url: string): void {
  const validated = validateReturnTo(url);
  if (!validated) {
    throw new BadRequestError("Invalid return_to URL");
  }
  res.redirect(validated);
}

function safeLocalPath(candidate: string): string {
  try {
    const base = "http://localhost";
    const url = new URL(candidate, base);
    if (url.origin !== base) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
