import config from "@/config";
import { Q } from "@/db";
import { UnauthorizedError } from "./error-handler";
import { asyncHandler } from "./async-handler";
import { extractBearerToken } from "@/utils/bearer-token";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = config.app.auth.accessToken.secret;

/**
 * Audience claim mods must carry. Enforced here so a web session JWT
 * (same secret, `aud: "createrington.web"`) can never be substituted
 * for a mod token.
 */
export const JWT_AUDIENCE_MOD = "createrington.mod";

function assertModJwtPayload(value: unknown): ModJwtPayload {
  if (!value || typeof value !== "object") {
    throw new UnauthorizedError("Invalid token");
  }
  const p = value as Record<string, unknown>;
  if (
    typeof p.uuid !== "string" ||
    typeof p.name !== "string" ||
    typeof p.aud !== "string" ||
    typeof p.iat !== "number" ||
    typeof p.exp !== "number"
  ) {
    throw new UnauthorizedError("Invalid token");
  }
  return p as unknown as ModJwtPayload;
}

/**
 * Verify JWT token from mods
 *
 * The mod generates short-lived JWTs (60 seconds) for each request
 * This middleware validates the signature, audience, and expiration.
 *
 * @throws {UnauthorizedError} if token is missing, invalid, or expired
 */
export const verifyModJWT = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError("Mod authentication required");
    }

    const raw = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      audience: JWT_AUDIENCE_MOD,
    });
    const decoded = assertModJwtPayload(raw);

    const now = Math.floor(Date.now() / 1000);
    if (decoded.iat > now + 60) {
      throw new UnauthorizedError("Token issued in the future");
    }

    req.modAuth = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Token has expired"));
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn("JWT verification failed:", error.message);
      next(new UnauthorizedError("Invalid token"));
    } else {
      logger.error("Mod JWT verification failed:", error);
      next(new UnauthorizedError("Invalid or expired mod token"));
    }
  }
};

/**
 * Per-request proof-of-possession: reject mod requests whose JWT UUID
 * doesn't resolve to a registered player. Runs after `verifyModJWT`,
 * which populates `req.modAuth`. Replaces the login-endpoint check that
 * used to gate arbitrary UUIDs on issue.
 */
export const requireKnownPlayer: RequestHandler = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const uuid = req.modAuth?.uuid;
    if (!uuid) {
      throw new UnauthorizedError("Mod authentication required");
    }
    const player = await Q.player.find({ minecraftUuid: uuid });
    if (!player) {
      throw new UnauthorizedError("Unknown player");
    }
    next();
  },
);
