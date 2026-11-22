import { Q, db } from "@/db";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import type {
  AuthSession,
  AuthSessionFilters,
} from "@createrington/shared/db/auth_session.types";

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
 * instance falls back to strict theft detection. Revoking the old row and inserting its
 * successor run in one transaction that only proceeds if it claimed the row, so two
 * rotations that slip past the cache never both issue a successor: the loser is treated
 * as a replay. The hourly cleanup of expired rows runs between the container's
 * `initialize()` and `shutdown()`.
 */
export class SessionService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private recentRotations = new Map<
    string,
    { promise: Promise<RotateResult | null>; expiresAt: number }
  >();

  /** Starts the hourly cleanup of expired sessions. */
  initialize(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpired().catch((error: unknown) => {
          logger.error("Expired auth session cleanup failed:", error);
        });
      },
      60 * 60 * 1000,
    );
    this.cleanupInterval.unref();
  }

  /** Stops the hourly cleanup. */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Issues a fresh session in a new token family and returns the raw refresh token to set as a cookie. */
  async createSession(params: CreateSessionParams): Promise<string> {
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hash(rawToken);
    const expiresAt = refreshTokenService.getExpiresAt();

    await Q.auth.session.create({
      discordId: params.discordId,
      discordUsername: params.username,
      discordAvatar: params.avatar ?? null,
      tokenHash,
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

      const successor = await Q.auth.session.find({
        tokenHash: refreshTokenService.hash(result.rawToken),
      });
      if (!successor) return null;
      if (successor.revokedAt) {
        const next = this.recentRotations.get(
          refreshTokenService.hash(result.rawToken),
        );
        if (!next || next.expiresAt <= Date.now()) return null;
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
    const session = await Q.auth.session.find({ tokenHash });

    if (!session) {
      logger.warn("Refresh token rotation failed: token not found");
      return null;
    }

    if (session.revokedAt) {
      await this.revokeFamilyAsTheft(session);
      return null;
    }

    if (session.expiresAt < new Date()) {
      logger.debug(
        `Refresh token expired for user ${session.discordId}, revoking`,
      );
      await Q.auth.session.revokeById(session.id);
      return null;
    }

    const newRawToken = refreshTokenService.generate();

    const rotated = await db.inTransaction(async (tx) => {
      const claimed = await tx.auth.session.revokeById(session.id);
      if (!claimed) return false;

      await tx.auth.session.create({
        discordId: session.discordId,
        discordUsername: session.discordUsername,
        discordAvatar: session.discordAvatar,
        tokenHash: refreshTokenService.hash(newRawToken),
        familyId: session.familyId,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt: refreshTokenService.getExpiresAt(),
      });
      return true;
    });

    if (!rotated) {
      await this.revokeFamilyAsTheft(session);
      return null;
    }

    logger.debug(
      `Rotated refresh token for user ${session.discordId} (family: ${session.familyId})`,
    );

    return {
      rawToken: newRawToken,
      discordId: session.discordId,
      discordUsername: session.discordUsername,
      discordAvatar: session.discordAvatar,
    };
  }

  private async revokeFamilyAsTheft(session: AuthSession): Promise<void> {
    logger.warn(
      `Refresh token theft detected for user ${session.discordId}, revoking family ${session.familyId}`,
    );
    await this.revokeLive({ familyId: session.familyId });
  }

  private async revokeLive(filters: AuthSessionFilters): Promise<void> {
    await Q.auth.session.updateAll(
      { revokedAt: new Date() },
      { ...filters, revokedAt: { $exists: false } },
    );
  }

  /** Revokes the single session identified by the given raw refresh token (normal logout). */
  async revokeByToken(rawToken: string): Promise<void> {
    await this.revokeLive({ tokenHash: refreshTokenService.hash(rawToken) });
  }

  /** Revokes every active session for the given user (logout-all or forced sign-out). */
  async revokeAllForUser(discordId: string): Promise<void> {
    await this.revokeLive({ discordId });
    logger.info(`Revoked all sessions for user ${discordId}`);
  }

  /** Deletes expired sessions from the database; invoked hourly, also safe to call on demand. */
  async cleanupExpired(): Promise<void> {
    const deleted = await Q.auth.session.deleteAll({
      expiresAt: { $lt: new Date() },
    });
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired auth sessions`);
    }
  }
}

export const sessionService = new SessionService();
