import { Q } from "@/db";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import type { AuthLauncherSession } from "@createrington/shared/db/auth_launcher_session.types";

interface CreateLauncherSessionParams {
  minecraftUuid: string;
  ip?: string;
  userAgent?: string;
}

interface LauncherRotateResult {
  rawToken: string;
  minecraftUuid: string;
}

/**
 * Manages launcher sessions backed by the `auth_launcher_session` table, kept apart from
 * the web `auth_session` table so a launcher refresh token can never mint a web session.
 * Issues opaque refresh tokens on sign-in, rotates them on each use, and revokes the whole
 * token family when an already-revoked token is replayed (theft detection). Singleton; an
 * hourly cleanup of expired rows starts on first access.
 */
class LauncherSessionService {
  private static instance: LauncherSessionService;

  private constructor() {
    setInterval(() => void this.cleanupExpired(), 60 * 60 * 1000).unref();
  }

  static getInstance(): LauncherSessionService {
    if (!LauncherSessionService.instance) {
      LauncherSessionService.instance = new LauncherSessionService();
    }
    return LauncherSessionService.instance;
  }

  /** Issues a session in a new token family and returns the raw refresh token. */
  async createSession(params: CreateLauncherSessionParams): Promise<string> {
    const rawToken = refreshTokenService.generate();

    await Q.auth.launcher.session.create({
      playerMinecraftUuid: params.minecraftUuid,
      tokenHash: refreshTokenService.hash(rawToken),
      ipAddress: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt: refreshTokenService.getExpiresAt(),
    });

    logger.debug(`Created launcher session for ${params.minecraftUuid}`);
    return rawToken;
  }

  /**
   * Rotates a refresh token: revokes the current session and issues a new one in the same
   * family. Returns null when the token is unknown, expired, or already revoked; replay of
   * a revoked token revokes the entire family as theft.
   */
  async rotateToken(
    rawToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LauncherRotateResult | null> {
    const tokenHash = refreshTokenService.hash(rawToken);
    const session = await Q.auth.launcher.session.find({ tokenHash });

    if (!session) {
      logger.warn("Launcher refresh token rotation failed: token not found");
      return null;
    }

    const claimed = await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { id: session.id, revokedAt: null },
    );

    if (claimed === 0) {
      logger.warn(
        `Launcher refresh token replay detected for ${session.playerMinecraftUuid}, revoking family ${session.familyId}`,
      );
      await this.revokeFamily(session.familyId);
      return null;
    }

    if (session.expiresAt < new Date()) {
      logger.debug(
        `Launcher refresh token expired for ${session.playerMinecraftUuid}`,
      );
      return null;
    }

    const newRawToken = refreshTokenService.generate();

    await Q.auth.launcher.session.create({
      playerMinecraftUuid: session.playerMinecraftUuid,
      tokenHash: refreshTokenService.hash(newRawToken),
      familyId: session.familyId,
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
      expiresAt: refreshTokenService.getExpiresAt(),
    });

    return {
      rawToken: newRawToken,
      minecraftUuid: session.playerMinecraftUuid,
    };
  }

  /** Revokes the single session identified by the given raw refresh token (launcher sign-out). */
  async revokeByToken(rawToken: string): Promise<void> {
    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { tokenHash: refreshTokenService.hash(rawToken), revokedAt: null },
    );
  }

  /** Revokes every active launcher session for the player (removal, ban, or forced sign-out). */
  async revokeAllForPlayer(minecraftUuid: string): Promise<void> {
    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { playerMinecraftUuid: minecraftUuid, revokedAt: null },
    );
    logger.info(`Revoked all launcher sessions for player ${minecraftUuid}`);
  }

  /** Active (not revoked, not expired) launcher sessions for the player, most recently used first. */
  async listActive(minecraftUuid: string): Promise<AuthLauncherSession[]> {
    return await Q.auth.launcher.session.findAll(
      {
        playerMinecraftUuid: minecraftUuid,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { orderBy: "lastUsedAt", orderDirection: "desc" },
    );
  }

  /** Deletes expired launcher sessions; invoked hourly, also safe to call on demand. */
  async cleanupExpired(): Promise<void> {
    const deleted = await Q.auth.launcher.session.deleteAll({
      expiresAt: { $lt: new Date() },
    });
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired launcher sessions`);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { familyId, revokedAt: null },
    );
  }
}

export const launcherSessionService = LauncherSessionService.getInstance();
