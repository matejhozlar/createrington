import type { LauncherPlayer } from "@createrington/shared/launcher";
import config from "@/config";
import { InvalidJwtPayloadError } from "@/services/auth/jwt/jwt.service";
import jwt from "jsonwebtoken";

export const JWT_AUDIENCE_LAUNCHER = "createrington.launcher";

export const LAUNCHER_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export class LauncherTokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "LauncherTokenExpiredError";
  }
}

export type LauncherJwtPayload = LauncherPlayer;

/**
 * Issues and verifies the short-lived HS256 access tokens handed to the Createrington
 * Launcher. Tokens are signed with `LAUNCHER_JWT_SECRET` and the `createrington.launcher`
 * audience, so they never satisfy a web or mod auth check, and web or mod tokens never
 * satisfy a launcher one. Carries the Minecraft identity only, no Discord identity or role.
 * Tokens live `LAUNCHER_ACCESS_TOKEN_TTL_SECONDS` (15 minutes), independent of the web token
 * lifetime: launcher clients are written against this value, and it is also how long a banned
 * or removed player keeps access until the next refresh rejects them.
 * Singleton; `isEnabled()` is false when the secret is not configured, and signing or
 * verifying in that state throws.
 */
export class LauncherJwtService {
  private static instance: LauncherJwtService;

  private readonly secret: string;

  private constructor() {
    this.secret = config.app.auth.launcherAccessToken.secret;
  }

  public static getInstance(): LauncherJwtService {
    if (!LauncherJwtService.instance) {
      LauncherJwtService.instance = new LauncherJwtService();
    }
    return LauncherJwtService.instance;
  }

  /** True when `LAUNCHER_JWT_SECRET` is configured and launcher sign-in can be offered. */
  isEnabled(): boolean {
    return this.secret.length > 0;
  }

  /** Signs a new launcher access token for a verified player. */
  generate(payload: LauncherJwtPayload): string {
    return jwt.sign(
      {
        minecraftUuid: payload.minecraftUuid,
        minecraftUsername: payload.minecraftUsername,
      },
      this.requireSecret(),
      {
        algorithm: "HS256",
        audience: JWT_AUDIENCE_LAUNCHER,
        expiresIn: LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
      },
    );
  }

  /**
   * Verifies signature, audience, and payload shape, returning the decoded payload.
   * Throws `LauncherTokenExpiredError` for an expired token, otherwise `Error("Invalid token")`
   * or `InvalidJwtPayloadError`.
   */
  verify(token: string): LauncherJwtPayload {
    const secret = this.requireSecret();
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience: JWT_AUDIENCE_LAUNCHER,
      });
      return assertLauncherJwtPayload(decoded);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new LauncherTokenExpiredError();
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

  private requireSecret(): string {
    if (!this.secret) {
      throw new Error("LAUNCHER_JWT_SECRET environment variable is missing");
    }
    return this.secret;
  }
}

export const launcherJwtService = LauncherJwtService.getInstance();

function assertLauncherJwtPayload(value: unknown): LauncherJwtPayload {
  if (!value || typeof value !== "object") {
    throw new InvalidJwtPayloadError();
  }
  const p = value as Record<string, unknown>;
  if (
    typeof p.minecraftUuid !== "string" ||
    typeof p.minecraftUsername !== "string"
  ) {
    throw new InvalidJwtPayloadError();
  }
  return {
    minecraftUuid: p.minecraftUuid,
    minecraftUsername: p.minecraftUsername,
  };
}
