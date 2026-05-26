import config from "@/config";
import type { AuthenticatedUser } from "@/services/discord/oauth/oauth.service";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";

/**
 * Audience claim for web session tokens. Mod-signed tokens carry
 * `createrington.mod` instead, so a mod token can never satisfy a web
 * auth check even though both use the same HS256 secret.
 */
export const JWT_AUDIENCE_WEB = "createrington.web";

/** Thrown when a token verifies cryptographically but the payload shape is wrong. */
export class InvalidJwtPayloadError extends Error {
  constructor(message = "Invalid token payload") {
    super(message);
    this.name = "InvalidJwtPayloadError";
  }
}

/**
 * Issues and verifies the short-lived HS256 access tokens used as Bearer credentials
 * (default 15m expiry). Tokens are always signed and verified with the
 * `createrington.web` audience so mod-signed tokens (same secret, `createrington.mod`
 * audience) cannot satisfy a web auth check. Singleton; throws on instantiation if
 * `JWT_ACCESS_SECRET` is missing.
 */
export class JWTService {
  private static instance: JWTService;

  private readonly secret: string;
  private readonly expiresIn: string;

  private constructor() {
    this.secret = config.app.auth.accessToken.secret;
    this.expiresIn = config.app.auth.accessToken.expiresIn;

    if (!this.secret) {
      throw new Error("JWT_ACCESS_SECRET environment variable is missing");
    }
  }

  public static getInstance(): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService();
    }
    return JWTService.instance;
  }

  /** Signs a new access token for an authenticated user. */
  generate(user: AuthenticatedUser): string {
    const payload: JWTPayload = {
      discordId: user.discordId,
      username: user.username,
      role: user.role,
      isAdmin: user.isAdmin,
      minecraftUuid: user.minecraftUuid,
      minecraftUsername: user.minecraftUsername,
    };

    if (user.avatar) {
      payload.avatar = user.avatar;
    }

    const token = jwt.sign(payload, this.secret, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_WEB,
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });

    logger.debug(
      `Generated access token for ${user.minecraftUsername} (${user.username})`,
    );
    return token;
  }

  /** Signs an access token directly from an existing payload (used by the refresh flow). */
  generateFromPayload(payload: JWTPayload): string {
    const tokenPayload: JWTPayload = {
      discordId: payload.discordId,
      username: payload.username,
      role: payload.role,
      isAdmin: payload.isAdmin,
      minecraftUuid: payload.minecraftUuid,
      minecraftUsername: payload.minecraftUsername,
    };

    if (payload.avatar) {
      tokenPayload.avatar = payload.avatar;
    }

    return jwt.sign(tokenPayload, this.secret, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_WEB,
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  /**
   * Verifies signature, audience, and payload shape, returning the decoded payload.
   * Throws `Error("Token expired")`, `Error("Invalid token")`, or
   * `InvalidJwtPayloadError` depending on the failure (the shape check exists because
   * `jwt.verify` only validates signature/exp, not payload structure).
   */
  verify(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        audience: JWT_AUDIENCE_WEB,
      });
      return assertWebJwtPayload(decoded);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid token");
      }
      if (error instanceof InvalidJwtPayloadError) {
        throw error;
      }
      throw new Error("Token verification failed");
    }
  }
}

export const jwtService = JWTService.getInstance();

const AUTH_ROLES = Object.values(AuthRole) as string[];

function assertWebJwtPayload(value: unknown): JWTPayload {
  if (!value || typeof value !== "object") {
    throw new InvalidJwtPayloadError();
  }
  const p = value as Record<string, unknown>;
  if (
    typeof p.discordId !== "string" ||
    typeof p.username !== "string" ||
    typeof p.minecraftUuid !== "string" ||
    typeof p.minecraftUsername !== "string" ||
    typeof p.isAdmin !== "boolean" ||
    typeof p.role !== "string" ||
    !AUTH_ROLES.includes(p.role) ||
    (p.avatar !== undefined && typeof p.avatar !== "string")
  ) {
    throw new InvalidJwtPayloadError();
  }
  return p as unknown as JWTPayload;
}
