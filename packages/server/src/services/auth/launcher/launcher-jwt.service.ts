import type { LauncherPlayer } from "@createrington/shared/launcher";
import config from "@/config";
import {
  InvalidJwtPayloadError,
  verifyHs256,
} from "@/services/auth/jwt/jwt.service";
import { SignJWT } from "jose";

export const JWT_AUDIENCE_LAUNCHER = "createrington.launcher";

export const LAUNCHER_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface LauncherTokenClaims extends LauncherPlayer {
  familyId: string;
}

export interface LauncherJwtPayload extends LauncherTokenClaims {
  issuedAt: number;
}

/**
 * Issues and verifies the short-lived HS256 access tokens handed to the Createrington
 * Launcher. Tokens are signed with `LAUNCHER_JWT_SECRET` and the `createrington.launcher`
 * audience, so they never satisfy a web or mod auth check, and web or mod tokens never
 * satisfy a launcher one. Carries the Minecraft identity and the id of the refresh token
 * family it was issued in, no Discord identity or role. Tokens live
 * `LAUNCHER_ACCESS_TOKEN_TTL_SECONDS` (15 minutes), independent of the web token lifetime:
 * launcher clients are written against this value. A token is cut off before it expires
 * when its family or its player is denied (see `launcher-token-denylist`).
 * Singleton; `isEnabled()` is false when the secret is not configured, and signing or
 * verifying in that state throws.
 */
export class LauncherJwtService {
  private readonly key: Uint8Array;

  constructor() {
    this.key = new TextEncoder().encode(
      config.app.auth.launcherAccessToken.secret,
    );
  }

  /** True when `LAUNCHER_JWT_SECRET` is configured and launcher sign-in can be offered. */
  isEnabled(): boolean {
    return this.key.length > 0;
  }

  /** Signs a new launcher access token for a verified player's session family. */
  generate(claims: LauncherTokenClaims): Promise<string> {
    return new SignJWT({
      minecraftUuid: claims.minecraftUuid,
      minecraftUsername: claims.minecraftUsername,
      familyId: claims.familyId,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setAudience(JWT_AUDIENCE_LAUNCHER)
      .setExpirationTime(`${LAUNCHER_ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.requireKey());
  }

  /**
   * Verifies signature, audience, and payload shape, returning the decoded payload.
   * Throws `TokenExpiredError` for an expired token, otherwise `Error("Invalid token")`
   * or `InvalidJwtPayloadError`.
   */
  async verify(token: string): Promise<LauncherJwtPayload> {
    return assertLauncherJwtPayload(
      await verifyHs256(token, this.requireKey(), JWT_AUDIENCE_LAUNCHER),
    );
  }

  private requireKey(): Uint8Array {
    if (!this.isEnabled()) {
      throw new Error("LAUNCHER_JWT_SECRET environment variable is missing");
    }
    return this.key;
  }
}

export const launcherJwtService = new LauncherJwtService();

function assertLauncherJwtPayload(value: unknown): LauncherJwtPayload {
  if (!value || typeof value !== "object") {
    throw new InvalidJwtPayloadError();
  }
  const p = value as Record<string, unknown>;
  if (
    typeof p.minecraftUuid !== "string" ||
    typeof p.minecraftUsername !== "string" ||
    typeof p.familyId !== "string" ||
    typeof p.iat !== "number"
  ) {
    throw new InvalidJwtPayloadError();
  }
  return {
    minecraftUuid: p.minecraftUuid,
    minecraftUsername: p.minecraftUsername,
    familyId: p.familyId,
    issuedAt: p.iat,
  };
}
