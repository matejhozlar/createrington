import config from "@/config";
import type { AuthenticatedUser } from "@/services/discord/oauth/oauth.service";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "@createrington/shared";

/**
 * JWT service for creating and verifying authentication tokens
 */
export class JWTService {
  private static instance: JWTService;

  private readonly secret: string;

  private constructor() {
    this.secret = config.app.auth.jwt.secret;

    if (!this.secret) {
      throw new Error("JWT_SECRET environment variable is missing");
    }
  }

  public static getInstance(): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService();
    }
    return JWTService.instance;
  }

  /**
   * Generates a JWT token for an authenticated user
   *
   * @param user - Authenticated user data (includes uuid and name)
   * @returns Signed JWT token
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

    const token = jwt.sign(payload, this.secret, {
      expiresIn: "7d",
    });

    logger.debug(
      `Generated JWT for user ${user.minecraftUsername} (${user.username})`,
    );
    return token;
  }

  /**
   * Verifies and decodes a JWT token
   *
   * @param token - JWT token to verify
   * @returns Decoded token payload
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
   *
   * @param token - JWT token to decode
   * @returns Decoded token payload or nul
   */
  decode(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if a token is expired without throwing an error
   *
   * @param token - JWT token to check
   * @returns True if token is expired, false otherwise
   */
  isExpired(token: string): boolean {
    try {
      this.verify(token);
      return false;
    } catch (error) {
      if (error instanceof Error && error.message === "Token expired") {
        return true;
      }
      return false;
    }
  }

  /**
   * Refreshes a token by generating a new one with the same payload
   *
   * @param token - Existing JWT token
   * @returns New JWT token
   */
  refresh(token: string): string {
    const decoded = this.decode(token);

    if (!decoded) {
      throw new Error("Invalid token");
    }

    const newToken = jwt.sign(
      {
        discordId: decoded.discordId,
        username: decoded.username,
        role: decoded.role,
        isAdmin: decoded.isAdmin,
        minecraftUuid: decoded.minecraftUuid,
        minecraftUsername: decoded.minecraftUsername,
      },
      this.secret,
      { expiresIn: "7d" },
    );

    logger.debug(
      `Refreshed JWT for user ${decoded.minecraftUsername} (${decoded.username})`,
    );
    return newToken;
  }
}

export const jwtService = JWTService.getInstance();
