import config from "@/config";
import type { AuthenticatedUser } from "@/services/discord/oauth/oauth.service";
import { errors, jwtVerify, SignJWT } from "jose";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";

export const JWT_AUDIENCE_WEB = "createrington.web";

/** Thrown when a web or launcher access token is past its expiry. */
export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

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
  private readonly key: Uint8Array;
  private readonly expiresIn: string;

  constructor() {
    const secret = config.app.auth.accessToken.secret;
    this.expiresIn = config.app.auth.accessToken.expiresIn;

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET environment variable is missing");
    }
    this.key = new TextEncoder().encode(secret);
  }

  /** Signs a new access token for an authenticated user. */
  async generate(user: AuthenticatedUser): Promise<string> {
    const token = await this.generateFromPayload(user);
    logger.debug(
      `Generated access token for ${user.minecraftUsername} (${user.username})`,
    );
    return token;
  }

  /** Signs an access token directly from an existing payload (used by the refresh flow). */
  generateFromPayload(payload: JWTPayload): Promise<string> {
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

    return new SignJWT({ ...tokenPayload })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setAudience(JWT_AUDIENCE_WEB)
      .setExpirationTime(this.expiresIn)
      .sign(this.key);
  }

  /**
   * Verifies signature, audience, and payload shape, returning the decoded payload.
   * Throws `TokenExpiredError`, `Error("Invalid token")`, or
   * `InvalidJwtPayloadError` depending on the failure (the shape check exists because
   * `jwtVerify` only validates signature and registered claims, not payload structure).
   */
  async verify(token: string): Promise<JWTPayload> {
    return assertWebJwtPayload(
      await verifyHs256(token, this.key, JWT_AUDIENCE_WEB),
    );
  }
}

export const jwtService = new JWTService();

/** Verifies an HS256 token for one audience, mapping jose failures to `TokenExpiredError` or `Error("Invalid token")`. */
export async function verifyHs256(
  token: string,
  key: Uint8Array,
  audience: string,
): Promise<unknown> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      audience,
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new TokenExpiredError();
    }
    if (error instanceof errors.JOSEError) {
      throw new Error("Invalid token");
    }
    throw new Error("Token verification failed");
  }
}

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
