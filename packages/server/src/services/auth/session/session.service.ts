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
 * Session Service
 *
 * Manages server-side auth sessions backed by the auth_session table:
 * - Creates new sessions on login, issuing opaque refresh tokens
 * - Rotates refresh tokens on each use, invalidating the previous one
 * - Detects token theft via family-based reuse detection and revokes entire families
 * - Revokes individual sessions on logout and all sessions on logout-all
 * - Periodically purges expired sessions from the database
 *
 * NOTE: Instantiated as a singleton: the cleanup interval starts automatically
 * on first access and runs every hour for the lifetime of the process
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

  /** Returns the singleton instance, creating it on first call */
  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Create a new session for a user after login
   *
   * Generates a fresh opaque refresh token, hashes it for storage, and
   * inserts a new session record in its own token family.
   *
   * @param params - Session creation parameters (Discord identity + optional request metadata)
   * @returns The raw (unhashed) refresh token to be sent as an httpOnly cookie
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
      familyId: null, // new family: DB default gen_random_uuid()
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
   * Rotate a refresh token, implementing the full token reuse detection flow
   *
   * Workflow:
   * 1. Hash the incoming token and look up the matching session
   * 2. Unknown token → return null
   * 3. Already-revoked token → theft detected → revoke entire family → return null
   * 4. Expired token → revoke the session → return null
   * 5. Valid token → revoke old session, issue new session in the same family
   *
   * @param rawToken - The raw refresh token received from the client cookie
   * @param ip - Optional client IP address to record on the new session
   * @param userAgent - Optional user-agent string to record on the new session
   * @returns The new raw token and user identity, or null if rotation was rejected
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

    // Valid: rotate (revoke old, create new in same family)
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
   * Revoke a single session by its raw refresh token
   *
   * Used during normal logout to invalidate the current device's session.
   *
   * @param rawToken - The raw refresh token to revoke
   */
  async revokeByToken(rawToken: string): Promise<void> {
    const tokenHash = refreshTokenService.hash(rawToken);
    await auth.session.revokeByTokenHash(tokenHash);
  }

  /**
   * Revoke all active sessions for a user
   *
   * Used for logout-all flows or when a security event requires invalidating
   * every device simultaneously.
   *
   * @param discordId - The Discord ID of the user whose sessions should be revoked
   */
  async revokeAllForUser(discordId: string): Promise<void> {
    await auth.session.revokeAllForUser(discordId);
    logger.info(`Revoked all sessions for user ${discordId}`);
  }

  /**
   * Delete all expired sessions from the database
   *
   * Called automatically on the hourly cleanup interval. Also safe to call
   * manually if an on-demand purge is needed.
   *
   * @returns Promise that resolves when the cleanup query has completed
   */
  async cleanupExpired(): Promise<void> {
    const deleted = await auth.session.deleteExpired();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired auth sessions`);
    }
  }
}

export const sessionService = SessionService.getInstance();
