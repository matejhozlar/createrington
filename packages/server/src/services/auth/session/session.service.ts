import { auth } from "@/db";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";

interface CreateSessionParams {
  discordId: string;
  username: string;
  avatar?: string;
  ip?: string;
  userAgent?: string;
}

interface RotateResult {
  rawToken: string;
  discordId: string;
  discordUsername: string | null;
  discordAvatar: string | null;
}

/**
 * Session service
 *
 * Manages server-side auth sessions backed by the auth_session table.
 * Implements refresh token rotation with family-based theft detection.
 */
class SessionService {
  private static instance: SessionService;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => this.cleanupExpired(),
      60 * 60 * 1000,
    );
  }

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Create a new session for a user after login.
   * Returns the raw (unhashed) refresh token to be sent as a cookie.
   */
  async createSession(params: CreateSessionParams): Promise<string> {
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hash(rawToken);
    const expiresAt = refreshTokenService.getExpiresAt();

    await auth.session.insertSession({
      discordId: params.discordId,
      discordUsername: params.username,
      discordAvatar: params.avatar ?? null,
      tokenHash,
      familyId: null, // new family — DB default gen_random_uuid()
      ipAddress: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt,
    });

    logger.debug(
      `Created session for ${params.username} (${params.discordId})`,
    );
    return rawToken;
  }

  /**
   * Rotate a refresh token.
   *
   * 1. Hash the incoming token → look up session
   * 2. If not found → return null (unknown token)
   * 3. If revoked → **theft detected** → revoke entire family → return null
   * 4. If expired → revoke → return null
   * 5. Valid: revoke old, create new session in same family, return new token + user info
   */
  async rotateToken(
    rawToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<RotateResult | null> {
    const tokenHash = refreshTokenService.hash(rawToken);
    const session = await auth.session.findByTokenHash(tokenHash);

    // Unknown token
    if (!session) {
      logger.warn("Refresh token rotation failed: token not found");
      return null;
    }

    // Theft detection: token was already revoked → attacker replaying old token
    if (session.revoked_at) {
      logger.warn(
        `Refresh token theft detected for user ${session.discord_id}, revoking family ${session.family_id}`,
      );
      await auth.session.revokeByFamily(session.family_id);
      return null;
    }

    // Expired
    if (new Date(session.expires_at) < new Date()) {
      logger.debug(
        `Refresh token expired for user ${session.discord_id}, revoking`,
      );
      await auth.session.revokeById(session.id);
      return null;
    }

    // Valid — rotate: revoke old, create new in same family
    await auth.session.revokeById(session.id);

    const newRawToken = refreshTokenService.generate();
    const newTokenHash = refreshTokenService.hash(newRawToken);
    const expiresAt = refreshTokenService.getExpiresAt();

    await auth.session.insertSession({
      discordId: session.discord_id,
      discordUsername: session.discord_username,
      discordAvatar: session.discord_avatar,
      tokenHash: newTokenHash,
      familyId: session.family_id,
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
    });

    logger.debug(
      `Rotated refresh token for user ${session.discord_id} (family: ${session.family_id})`,
    );

    return {
      rawToken: newRawToken,
      discordId: session.discord_id,
      discordUsername: session.discord_username,
      discordAvatar: session.discord_avatar,
    };
  }

  /**
   * Revoke a single session by its raw refresh token (logout)
   */
  async revokeByToken(rawToken: string): Promise<void> {
    const tokenHash = refreshTokenService.hash(rawToken);
    await auth.session.revokeByTokenHash(tokenHash);
  }

  /**
   * Revoke all sessions for a user (logout-all)
   */
  async revokeAllForUser(discordId: string): Promise<void> {
    await auth.session.revokeAllForUser(discordId);
    logger.info(`Revoked all sessions for user ${discordId}`);
  }

  /**
   * Delete expired sessions from the database
   */
  async cleanupExpired(): Promise<void> {
    const deleted = await auth.session.deleteExpired();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired auth sessions`);
    }
  }
}

export const sessionService = SessionService.getInstance();
