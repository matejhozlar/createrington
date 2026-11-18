import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@/errors";
import { jwtService } from "@/services/auth/jwt";
import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { AuthRole } from "@createrington/shared/auth";
import config from "@/config";
import { extractBearerToken } from "@/app/utils/bearer-token";

function extractAccessToken(req: Request): string | undefined {
  const headerToken = extractBearerToken(req);
  if (headerToken) return headerToken;
  if (!accessCookieService.isEnabled()) return undefined;
  return accessCookieService.extractFromRequest(req);
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
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

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
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

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!req.user.isAdmin) {
      logger.warn(
        `User ${req.user.minecraftUsername} (${req.user.discordId}) attempted to access admin endpoint`,
      );
      throw new ForbiddenError("Admin access required");
    }

    const stillAdmin = await adminStatusService.isAdmin(req.user.discordId);
    if (!stillAdmin) {
      logger.warn(
        `User ${req.user.minecraftUsername} (${req.user.discordId}) carries stale admin JWT after demote`,
      );
      throw new ForbiddenError("Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

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

function safeOrigin(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

let cachedAllowedAuthOrigins: string[] | undefined;
function allowedAuthOrigins(): string[] {
  if (cachedAllowedAuthOrigins) return cachedAllowedAuthOrigins;
  cachedAllowedAuthOrigins = config.envMode.isProd
    ? [config.meta.links.website, ...config.app.auth.sso.corsOrigins]
    : [config.app.devClientOrigin];
  return cachedAllowedAuthOrigins;
}

export const requireTrustedOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const origin =
    safeOrigin(req.headers.origin) ?? safeOrigin(req.headers.referer);

  if (!origin) {
    logger.warn(
      `[origin] rejected ${req.method} ${req.path}: no Origin/Referer`,
    );
    throw new ForbiddenError("Missing origin");
  }

  if (!allowedAuthOrigins().includes(origin)) {
    logger.warn(
      `[origin] rejected ${req.method} ${req.path}: untrusted origin ${origin}`,
    );
    throw new ForbiddenError("Untrusted origin");
  }

  next();
};
