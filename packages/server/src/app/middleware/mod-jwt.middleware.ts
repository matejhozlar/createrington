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
  // aud is enforced by jwt.verify above; no need to re-check here.
  // uuid/name are per-player claims, emitted by CRNet only when the caller
  // supplies a playerUuid, so server-level tokens (heartbeats, syncs) lack
  // them legitimately. Validate the type only when the claim is present;
  // routes that need a specific player enforce presence via requireKnownPlayer.
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
 * In-process TTL cache of "player exists" to avoid re-querying on every
 * mod currency request. TTL matches the mod token lifetime so stale
 * positives are bounded: a player deleted mid-window may be admitted
 * for up to TTL, but downstream controllers still touch the player row
 * and fail there: this middleware is a fail-fast gate, not the sole
 * authorization check. Positives only; caching negatives would re-
 * introduce the just-registered-player rejection that killed /login.
 */
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

/** Test-only: drop all cache entries. The `__` prefix signals non-production. */
export function __resetPlayerExistsCacheForTests(): void {
  playerExistsCache.clear();
}

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
  },
);

/**
 * Extracts the authenticated player identity for controllers that run behind
 * `requireKnownPlayer`. `uuid` is guaranteed by that middleware; `name` falls
 * back to the uuid if the token didn't carry a display name (CRNet omits the
 * claim when its name resolver returns null, unlikely in practice because
 * requireKnownPlayer only admits known players, but kept safe).
 *
 * Throws if `req.modAuth.uuid` is missing, which would indicate middleware
 * misordering rather than a real auth failure.
 */
export function getAuthedPlayer(req: Request): { uuid: string; name: string } {
  const uuid = req.modAuth?.uuid;
  if (!uuid) {
    throw new UnauthorizedError("Mod authentication required");
  }
  return { uuid, name: req.modAuth?.name ?? uuid };
}
