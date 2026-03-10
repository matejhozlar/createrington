import config from "@/config";
import type { AuthenticatedUser } from "@/services/discord/oauth/oauth.service";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { JWTPayload } from "@createrington/shared/auth";

/**
 * JWT access token service
 *
 * Handles short-lived access token generation and verification.
 * Access tokens are sent as Bearer tokens and have a short expiry (default 15m).
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

  /**
   * Generates a short-lived access token for an authenticated user
   */
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
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });

    logger.debug(
      `Generated access token for ${user.minecraftUsername} (${user.username})`,
    );
    return token;
  }

  /**
   * Generates an access token from a raw JWT payload (used during refresh)
   */
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
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  /**
   * Verifies and decodes a JWT token
   *
   * @throws Error if token is invalid or expired
   */
  verify(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid token");
      }
      throw new Error("Token verification failed");
    }
  }

  /**
   * Decodes a token without verifying (for debugging only)
   */
  decode(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (_error) {
      return null;
    }
  }
}

export const jwtService = JWTService.getInstance();
