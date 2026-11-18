import {
  discordOAuth,
  UnverifiedUserError,
} from "@/services/discord/oauth/oauth.service";
import type { Request, Response } from "express";
import {
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/app/middleware";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import { sessionService } from "@/services/auth/session/session.service";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { validateReturnTo } from "@/services/auth/sso/return-to";
import { issueSsoCode } from "@/services/auth/sso/code-store";
import {
  issueSsoState,
  peekSsoState,
  consumeSsoState,
} from "@/services/auth/sso/state-store";
import {
  isCodeExchangeReturnTo,
  resolveConsumerName,
} from "@/services/auth/sso/consumer";
import {
  OAUTH_STATE_TTL_MS,
  consumeOAuthState,
  issueOAuthState,
} from "@/services/auth/oauth/state-store";
import { verifyDevLoginToken } from "@/services/auth/dev-login/hmac";
import config from "@/config";
import { Q } from "@/db";
import {
  AuthRole,
  type JWTPayload,
  type RefreshResponse,
} from "@createrington/shared/auth";

function deriveRole(currentRole: AuthRole, isAdmin: boolean): AuthRole {
  if (currentRole === AuthRole.UNVERIFIED) return AuthRole.UNVERIFIED;
  return isAdmin ? AuthRole.ADMIN : AuthRole.USER;
}

const STATE_COOKIE_NAME = "oauth_state";
const stateCookieOptions = {
  httpOnly: true,
  secure: config.envMode.isProd,
  sameSite: "lax",
  path: "/api/auth",
} as const;

const SSO_SHARED_SCOPES = [
  "minecraftUsername",
  "playerId",
  "isMember",
] as const;

export class AuthController {
  static async getAuthUrl(_req: Request, res: Response): Promise<void> {
    const state = await issueOAuthState();
    if (!state) {
      throw new TooManyRequestsError("Too many pending sign-in attempts");
    }

    const authUrl = discordOAuth.generateAuthUrl(state);

    res.cookie(STATE_COOKIE_NAME, state, {
      ...stateCookieOptions,
      maxAge: OAUTH_STATE_TTL_MS,
    });

    res.json({
      success: true,
      data: {
        url: authUrl,
        state,
      },
    });
  }

  static async handleDiscordCallback(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { code, state } = req.body as { code?: unknown; state?: unknown };

    if (typeof code !== "string" || !code) {
      throw new BadRequestError("Authorization code is required");
    }

    if (
      typeof state !== "string" ||
      !state ||
      req.cookies?.[STATE_COOKIE_NAME] !== state
    ) {
      throw new BadRequestError("Invalid or expired state parameter");
    }

    if (!(await consumeOAuthState(state))) {
      throw new BadRequestError("Invalid or expired state parameter");
    }
    res.clearCookie(STATE_COOKIE_NAME, stateCookieOptions);

    try {
      const user = await discordOAuth.authenticate(code);

      const accessToken = jwtService.generate(user);

      const rawRefreshToken = await sessionService.createSession({
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      refreshTokenService.setCookie(res, rawRefreshToken);

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

  static async refreshToken(req: Request, res: Response): Promise<void> {
    const rawToken = refreshTokenService.extractFromRequest(req);

    if (!rawToken) {
      throw new UnauthorizedError("No refresh token");
    }

    const result = await sessionService.rotateToken(
      rawToken,
      req.ip,
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

    const data: RefreshResponse = { accessToken, user: payload };
    res.json({ success: true, data });
  }

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

  static async logout(req: Request, res: Response): Promise<void> {
    const rawToken = refreshTokenService.extractFromRequest(req);

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

  static async ssoStart(req: Request, res: Response): Promise<void> {
    if (!config.app.auth.sso.callbackUrl) {
      throw new BadRequestError("SSO is not configured on this server");
    }

    const rawReturnTo = req.query.return_to;
    const returnTo = validateReturnTo(
      typeof rawReturnTo === "string" ? rawReturnTo : undefined,
    );
    if (!returnTo) {
      throw new BadRequestError(
        "return_to is missing or not in the allowed list",
      );
    }

    const state = await issueSsoState(returnTo);
    if (!state) {
      throw new TooManyRequestsError("Too many pending sign-in attempts");
    }

    const consentUrl = new URL("/authorize", config.meta.links.website);
    consentUrl.searchParams.set("state", state);
    res.redirect(consentUrl.toString());
  }

  static async ssoConsent(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const rawState = req.query.state;
    const state = typeof rawState === "string" ? rawState : undefined;
    if (!state) {
      throw new BadRequestError("Missing state");
    }

    const entry = await peekSsoState(state);
    if (!entry) {
      throw new BadRequestError("Invalid or expired state parameter");
    }

    res.json({
      success: true,
      data: {
        appName: resolveConsumerName(entry.returnTo),
        appOrigin: new URL(entry.returnTo).origin,
        scopes: SSO_SHARED_SCOPES,
      },
    });
  }

  static async ssoAuthorize(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { state, action } = (req.body ?? {}) as {
      state?: unknown;
      action?: unknown;
    };
    if (typeof state !== "string" || !state) {
      throw new BadRequestError("Missing state");
    }
    if (action !== "approve" && action !== "deny") {
      throw new BadRequestError("Invalid action");
    }

    const entry = await consumeSsoState(state);
    if (!entry) {
      throw new BadRequestError("Invalid or expired state parameter");
    }
    const { returnTo } = entry;

    if (action === "deny") {
      logger.info(`User ${req.user.discordId} denied SSO to ${returnTo}`);
      res.json({
        success: true,
        data: {
          redirectUrl: safeReturnTo(redirectWithError(returnTo, "denied")),
        },
      });
      return;
    }

    if (isCodeExchangeReturnTo(returnTo)) {
      const ssoCode = await issueSsoCode({
        playerId: req.user.minecraftUuid,
        minecraftUsername: req.user.minecraftUsername,
        isMember: req.user.role !== AuthRole.UNVERIFIED,
        isOwner: req.user.discordId === config.app.auth.owner.discordId,
      });
      if (!ssoCode) {
        throw new TooManyRequestsError("Too many pending sign-in attempts");
      }

      logger.info(
        `User ${req.user.discordId} authorized code-exchange SSO to ${returnTo}`,
      );

      res.json({
        success: true,
        data: { redirectUrl: safeReturnTo(appendSsoCode(returnTo, ssoCode)) },
      });
      return;
    }

    accessCookieService.setCookie(
      res,
      jwtService.generateFromPayload(req.user),
    );

    logger.info(`User ${req.user.discordId} authorized SSO to ${returnTo}`);

    res.json({
      success: true,
      data: { redirectUrl: safeReturnTo(returnTo) },
    });
  }

  static async ssoCallback(req: Request, res: Response): Promise<void> {
    const callbackUrl = config.app.auth.sso.callbackUrl;
    const rawCode = req.query.code;
    const rawState = req.query.state;
    const code = typeof rawCode === "string" ? rawCode : undefined;
    const state = typeof rawState === "string" ? rawState : undefined;

    if (!code || !state) {
      throw new BadRequestError("Missing code or state");
    }

    const entry = await consumeSsoState(state);
    if (!entry) {
      throw new BadRequestError("Invalid or expired state parameter");
    }

    try {
      const user = await discordOAuth.authenticate(code, callbackUrl);

      if (isCodeExchangeReturnTo(entry.returnTo)) {
        const ssoCode = await issueSsoCode({
          playerId: user.minecraftUuid,
          minecraftUsername: user.minecraftUsername,
          isMember: true,
          isOwner: user.discordId === config.app.auth.owner.discordId,
        });
        if (!ssoCode) {
          throw new TooManyRequestsError("Too many pending sign-in attempts");
        }

        logger.info(
          `User ${user.discordId} completed code-exchange SSO to ${entry.returnTo}`,
        );

        safeSsoRedirect(res, appendSsoCode(entry.returnTo, ssoCode));
        return;
      }

      const accessToken = jwtService.generate(user);
      const rawRefreshToken = await sessionService.createSession({
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        ip: req.ip,
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

  static devSetRefresh(req: Request, res: Response): void {
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

function redirectWithError(returnTo: string, reason: string): string {
  try {
    const url = new URL(returnTo);
    url.searchParams.set("sso_error", reason);
    return url.toString();
  } catch {
    return returnTo;
  }
}

function safeSsoRedirect(res: Response, url: string): void {
  res.redirect(safeReturnTo(url));
}

function safeReturnTo(url: string): string {
  const validated = validateReturnTo(url);
  if (!validated) {
    throw new BadRequestError("Invalid return_to URL");
  }
  return validated;
}

function appendSsoCode(returnTo: string, code: string): string {
  const url = new URL(returnTo);
  url.searchParams.set("code", code);
  return url.toString();
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
