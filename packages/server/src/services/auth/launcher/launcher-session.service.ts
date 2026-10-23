import { db, Q } from "@/db";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";
import type { AuthLauncherSession } from "@createrington/shared/db/auth_launcher_session.types";
import {
  denyLauncherFamily,
  denyLauncherPlayer,
} from "./launcher-token-denylist";

interface CreateLauncherSessionParams {
  minecraftUuid: string;
  ip?: string;
  userAgent?: string;
}

export interface IssuedLauncherSession {
  refreshToken: string;
  familyId: string;
}

/**
 * Manages launcher sessions backed by the `auth_launcher_session` table, kept apart from
 * the web `auth_session` table so a launcher refresh token can never mint a web session.
 * Issues opaque refresh tokens on sign-in, rotates them on each use, and revokes the whole
 * token family when an already-revoked token is replayed (theft detection). Every revocation
 * also denies the access tokens already issued for the sessions it ends, so the launcher's
 * next request is refused, not only its next refresh. Singleton; an hourly cleanup of
 * expired rows starts on first access.
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

  /** Issues a session in a new token family and returns the raw refresh token with the family id. */
  async createSession(
    params: CreateLauncherSessionParams,
  ): Promise<IssuedLauncherSession> {
    const rawToken = refreshTokenService.generate();

    const session = await Q.auth.launcher.session.createAndReturn({
      playerMinecraftUuid: params.minecraftUuid,
      tokenHash: refreshTokenService.hash(rawToken),
      ipAddress: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt: refreshTokenService.getExpiresAt(),
    });

    logger.debug(`Created launcher session for ${params.minecraftUuid}`);
    return { refreshToken: rawToken, familyId: session.familyId };
  }

  /**
   * Looks up the session behind a refresh token without consuming it. Returns null when
   * the token is unknown or expired; replay of an already-revoked token revokes the entire
   * family as theft and also returns null.
   */
  async resolveActiveSession(
    rawToken: string,
  ): Promise<AuthLauncherSession | null> {
    const session = await Q.auth.launcher.session.find({
      tokenHash: refreshTokenService.hash(rawToken),
    });

    if (!session) {
      logger.warn("Launcher refresh failed: token not found");
      return null;
    }

    if (session.revokedAt) {
      await this.revokeFamilyAsReplay(session);
      return null;
    }

    if (session.expiresAt < new Date()) {
      logger.debug(
        `Launcher refresh token expired for ${session.playerMinecraftUuid}`,
      );
      return null;
    }

    return session;
  }

  /**
   * Revokes the given session and issues its successor in the same family, atomically, and
   * returns the new raw refresh token. A failure leaves the presented token usable for a
   * retry. Returns null when another request consumed the session first, which is treated
   * as a replay and revokes the family.
   */
  async rotateSession(
    session: AuthLauncherSession,
    ip?: string,
    userAgent?: string,
  ): Promise<string | null> {
    const newRawToken = refreshTokenService.generate();

    const rotated = await db.inTransaction(async (tx) => {
      const claimed = await tx.auth.launcher.session.updateAll(
        { revokedAt: new Date() },
        { id: session.id, revokedAt: null },
      );
      if (claimed === 0) return false;

      await tx.auth.launcher.session.create({
        playerMinecraftUuid: session.playerMinecraftUuid,
        tokenHash: refreshTokenService.hash(newRawToken),
        familyId: session.familyId,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt: refreshTokenService.getExpiresAt(),
      });
      return true;
    });

    if (!rotated) {
      await this.revokeFamilyAsReplay(session);
      return null;
    }

    return newRawToken;
  }

  /** Revokes the session family behind the raw refresh token and its access tokens (launcher sign-out). */
  async revokeByToken(rawToken: string): Promise<void> {
    const session = await Q.auth.launcher.session.find({
      tokenHash: refreshTokenService.hash(rawToken),
    });
    if (!session) return;

    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { familyId: session.familyId, revokedAt: null },
    );
    await denyLauncherFamily(session.familyId);
  }

  /** Revokes every launcher session and access token of the player (removal, ban, or forced sign-out). */
  async revokeAllForPlayer(minecraftUuid: string): Promise<void> {
    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { playerMinecraftUuid: minecraftUuid, revokedAt: null },
    );
    await denyLauncherPlayer(minecraftUuid);
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

  private async revokeFamilyAsReplay(
    session: AuthLauncherSession,
  ): Promise<void> {
    logger.warn(
      `Launcher refresh token replay detected for ${session.playerMinecraftUuid}, revoking family ${session.familyId}`,
    );
    await Q.auth.launcher.session.updateAll(
      { revokedAt: new Date() },
      { familyId: session.familyId, revokedAt: null },
    );
    await denyLauncherFamily(session.familyId);
  }
}

export const launcherSessionService = LauncherSessionService.getInstance();
