import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "./error-handler";
import { jwtService } from "@/services/auth/jwt";
import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import { AuthRole } from "@/services/discord/oauth/oauth.service";
import config from "@/config";
import { extractBearerToken } from "@/utils/bearer-token";

/**
 * Resolve the access token from either the `Authorization: Bearer <token>`
 * header (existing first-party clients) or the `crt_access` cookie set by
 * the SSO flow for cross-subdomain consumers.
 *
 * The header wins when both are present so explicit clients (mod API,
 * scripts) can override the ambient browser cookie.
 *
 * The cookie fallback is skipped entirely when the cookie service is
 * disabled (no COOKIE_DOMAIN configured) — without that the server never
 * sets a crt_access cookie, so accepting an attacker-supplied one would
 * just waste a JWT verify call. This keeps the disabled path strictly
 * equivalent to the pre-SSO behavior.
 */
function extractAccessToken(req: Request): string | undefined {
  const headerToken = extractBearerToken(req);
  if (headerToken) return headerToken;
  if (!accessCookieService.isEnabled()) return undefined;
  return accessCookieService.extractFromRequest(req);
}

/**
 * Extracts and verifies JWT token from request
 * Attaches user data to req.user if valid
 *
 * @throws UnauthorizedError if token is missing or invalid
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    const payload = jwtService.verify(token);
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError("Invalid or expired token"));
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token present
 * Useful for endpoints that behave differently for authenticated users
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractAccessToken(req);

    if (token) {
      const payload = jwtService.verify(token);
      req.user = payload;
    }

    next();
  } catch {
    next();
  }
};

/**
 * Requires user to have admin role
 * Must be used AFTER authenticate middleware
 *
 * @throws ForbiddenError if user is not an admin
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!req.user.isAdmin) {
    logger.warn(
      `User ${req.user.minecraftUsername} (${req.user.discordId}) attempted to access admin endpoint`,
    );
    throw new ForbiddenError("Admin access required");
  }

  next();
};

/**
 * Requires user to have at least USER role
 * Must be used after authenticate middleware
 *
 * @throws ForbiddenError if user is unverified
 */
export const requireUser = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (req.user.role === AuthRole.UNVERIFIED) {
    logger.warn(
      `Unverified user ${req.user.minecraftUsername} (${req.user.discordId}) attempted to access user endpoint`,
    );
    throw new ForbiddenError("Account verification required");
  }

  next();
};

/**
 * Requires user to match specific role(s)
 *
 * @param allowedRoles - Array of roles that can access the endpoint
 */
export const requireRole = (...allowedRoles: AuthRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `User ${req.user.minecraftUsername} with role ${
          req.user.role
        } attempted to access endpoint requiring ${allowedRoles.join(" or ")}`,
      );
      throw new ForbiddenError(`Required role: ${allowedRoles.join(" or ")}`);
    }

    next();
  };
};

/**
 * Requires user to be the resource owner or an admin
 *
 * @param getUserId - Function to extract the user ID from the request
 */
export const requireOwnerOrAdmin = (getUserId: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const resourceUserId = getUserId(req);

    if (req.user.discordId !== resourceUserId && !req.user.isAdmin) {
      logger.warn(
        `User ${req.user.minecraftUsername} attempted to access resource owned by ${resourceUserId}`,
      );
      throw new ForbiddenError("Access denied");
    }

    next();
  };
};

// Parse an origin URL safely; returns only the `scheme://host[:port]` portion.
function safeOrigin(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

// Config is immutable at runtime — cache after first call.
let cachedAllowedAuthOrigins: string[] | undefined;
function allowedAuthOrigins(): string[] {
  if (cachedAllowedAuthOrigins) return cachedAllowedAuthOrigins;
  cachedAllowedAuthOrigins = config.envMode.isProd
    ? [config.meta.links.website, ...config.app.auth.sso.corsOrigins]
    : ["http://localhost:3000"];
  return cachedAllowedAuthOrigins;
}

/**
 * CSRF guard for cookie-authenticated auth endpoints (refresh, logout).
 *
 * The refresh cookie is scoped to `.createrington.com`, so any subdomain
 * shares it. SameSite=Lax only blocks *cross-site* POSTs — same-site
 * subdomains can still fetch cross-origin-with-credentials. This middleware
 * rejects any request whose Origin (or Referer) isn't in the CORS allowlist.
 */
export const requireTrustedOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const origin =
    safeOrigin(req.headers.origin as string | undefined) ??
    safeOrigin(req.headers.referer as string | undefined);

  if (!origin) {
    logger.warn(
      `[origin] rejected ${req.method} ${req.path} — no Origin/Referer`,
    );
    throw new ForbiddenError("Missing origin");
  }

  if (!allowedAuthOrigins().includes(origin)) {
    logger.warn(
      `[origin] rejected ${req.method} ${req.path} — untrusted origin ${origin}`,
    );
    throw new ForbiddenError("Untrusted origin");
  }

  next();
};
