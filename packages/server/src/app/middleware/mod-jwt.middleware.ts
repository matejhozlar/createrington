import config from "@/config";
import { Q } from "@/db";
import { UnauthorizedError } from "@/errors";
import { extractBearerToken } from "@/app/utils/bearer-token";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { errors, jwtVerify } from "jose";

const JWT_KEY = new TextEncoder().encode(config.app.auth.modAccessToken.secret);

export const JWT_AUDIENCE_MOD = "createrington.mod";

function assertModJwtPayload(value: unknown): ModJwtPayload {
  if (!value || typeof value !== "object") {
    throw new UnauthorizedError("Invalid token");
  }
  const p = value as Record<string, unknown>;
  if (
    (p.uuid !== undefined && typeof p.uuid !== "string") ||
    (p.name !== undefined && typeof p.name !== "string") ||
    typeof p.iat !== "number" ||
    typeof p.exp !== "number"
  ) {
    throw new UnauthorizedError("Invalid token");
  }
  return p as unknown as ModJwtPayload;
}

export const verifyModJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError("Mod authentication required");
    }

    const { payload } = await jwtVerify(token, JWT_KEY, {
      algorithms: ["HS256"],
      audience: JWT_AUDIENCE_MOD,
    });
    const decoded = assertModJwtPayload(payload);

    const now = Math.floor(Date.now() / 1000);
    if (decoded.iat > now + 60) {
      throw new UnauthorizedError("Token issued in the future");
    }

    req.modAuth = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof errors.JWTExpired) {
      next(new UnauthorizedError("Token has expired"));
    } else if (error instanceof errors.JOSEError) {
      logger.warn("JWT verification failed:", error.message);
      next(new UnauthorizedError("Invalid token"));
    } else {
      logger.error("Mod JWT verification failed:", error);
      next(new UnauthorizedError("Invalid or expired mod token"));
    }
  }
};

const PLAYER_EXISTS_CACHE_TTL_MS = 60_000;
const playerExistsCache = new Map<string, number>();

function isPlayerCached(uuid: string): boolean {
  const expiresAt = playerExistsCache.get(uuid);
  if (expiresAt === undefined) return false;
  if (Date.now() >= expiresAt) {
    playerExistsCache.delete(uuid);
    return false;
  }
  return true;
}

function rememberPlayer(uuid: string): void {
  playerExistsCache.set(uuid, Date.now() + PLAYER_EXISTS_CACHE_TTL_MS);
}

export function __resetPlayerExistsCacheForTests(): void {
  playerExistsCache.clear();
}

export const requireKnownPlayer: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const uuid = req.modAuth?.uuid;
  if (!uuid) {
    throw new UnauthorizedError("Mod authentication required");
  }
  if (isPlayerCached(uuid)) {
    next();
    return;
  }
  const player = await Q.player.find({ minecraftUuid: uuid });
  if (!player) {
    throw new UnauthorizedError("Unknown player");
  }
  rememberPlayer(uuid);
  next();
};

export function getAuthedPlayer(req: Request): { uuid: string; name: string } {
  const uuid = req.modAuth?.uuid;
  if (!uuid) {
    throw new UnauthorizedError("Mod authentication required");
  }
  return { uuid, name: req.modAuth?.name ?? uuid };
}
