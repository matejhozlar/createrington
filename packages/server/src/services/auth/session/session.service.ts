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

const ROTATION_GRACE_MS = 60_000;

/**
 * Manages server-side auth sessions backed by the `auth_session` table: issues opaque
 * refresh tokens on login, rotates them on each use, and revokes whole token families
 * when a previously-revoked token is replayed (theft detection). Rotations are cached
 * in memory for a short grace window so concurrent refreshes from browser contexts
 * sharing one domain-scoped cookie (tabs, subdomains) all receive the same successor
 * instead of tripping theft detection. Grace replays re-validate the successor row
 * first, so explicit revocation (logout, ban, logout-all) always wins. The cache is
 * process-local and assumes a single-instance deployment; a restart or additional
 * instance falls back to strict theft detection. Instantiated as a singleton; an hourly
 * cleanup interval starts automatically on first access and runs for the lifetime of
 * the process.
 */
class SessionService {
  private static instance: SessionService;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private recentRotations = new Map<
    string,
    { promise: Promise<RotateResult | null>; expiresAt: number }
  >();

  private constructor() {
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

  /** Issues a fresh session in a new token family and returns the raw refresh token to set as a cookie. */
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
   * Rotates a refresh token in place: revokes the current session and issues a new one
   * in the same family. Repeated calls with the same token within the grace window
   * (concurrent or slightly stale refreshes from other tabs/subdomains) return the same
   * successor, re-validated against the database so revocation always wins; if the
   * successor was itself already rotated, the call follows the chain to the newest
   * token. Returns null when the token is unknown, expired, or has already been
   * revoked; replay of a revoked token outside the grace window revokes the entire
   * family as theft.
   */
  async rotateToken(
    rawToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<RotateResult | null> {
    const tokenHash = refreshTokenService.hash(rawToken);

    const recent = this.recentRotations.get(tokenHash);
    if (recent && recent.expiresAt > Date.now()) {
      const result = await recent.promise;
      if (!result) return null;

      const successor = await auth.session.findByTokenHash(
        refreshTokenService.hash(result.rawToken),
      );
      if (!successor) return null;
      if (successor.revoked_at) {
        return this.rotateToken(result.rawToken, ip, userAgent);
      }

      logger.info(
        `Refresh token reused within rotation grace window for user ${result.discordId}`,
      );
      return result;
    }

    const entry = {
      promise: this.performRotation(tokenHash, ip, userAgent),
      expiresAt: Date.now() + ROTATION_GRACE_MS,
    };
    this.recentRotations.set(tokenHash, entry);
    const evict = () => {
      if (this.recentRotations.get(tokenHash) === entry) {
        this.recentRotations.delete(tokenHash);
      }
    };
    setTimeout(evict, ROTATION_GRACE_MS).unref();

    let result: RotateResult | null;
    try {
      result = await entry.promise;
    } catch (error) {
      evict();
      throw error;
    }
    if (!result) {
      evict();
    }
    return result;
  }

  private async performRotation(
    tokenHash: string,
    ip?: string,
    userAgent?: string,
  ): Promise<RotateResult | null> {
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

  /** Revokes the single session identified by the given raw refresh token (normal logout). */
  async revokeByToken(rawToken: string): Promise<void> {
    const tokenHash = refreshTokenService.hash(rawToken);
    await auth.session.revokeByTokenHash(tokenHash);
  }

  /** Revokes every active session for the given user (logout-all or forced sign-out). */
  async revokeAllForUser(discordId: string): Promise<void> {
    await auth.session.revokeAllForUser(discordId);
    logger.info(`Revoked all sessions for user ${discordId}`);
  }

  /** Deletes expired sessions from the database; invoked hourly, also safe to call on demand. */
  async cleanupExpired(): Promise<void> {
    const deleted = await auth.session.deleteExpired();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired auth sessions`);
    }
  }
}

export const sessionService = SessionService.getInstance();
