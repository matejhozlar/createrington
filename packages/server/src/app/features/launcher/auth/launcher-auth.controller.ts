import type { Request, Response } from "express";
import {
  LauncherAuthErrorCode,
  type LauncherChallengeData,
  type LauncherMeData,
  type LauncherPlayer,
  type LauncherSessionData,
} from "@createrington/shared/launcher";
import { AppError, TooManyRequestsError, UnauthorizedError } from "@/errors";
import { getValidated } from "@/app/middleware/validation.middleware";
import { respondSuccess } from "@/app/middleware/api-envelope";
import { Q } from "@/db";
import {
  CHALLENGE_TTL_SECONDS,
  consumeLauncherChallenge,
  issueLauncherChallenge,
} from "@/services/auth/launcher/challenge-store";
import {
  LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
  launcherJwtService,
} from "@/services/auth/launcher/launcher-jwt.service";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";
import { verifyMojangJoin } from "@/services/auth/launcher/mojang-has-joined";
import type { RefreshTokenBody, VerifyBody } from "./launcher-auth.schemas";

function launcherError(
  message: string,
  statusCode: number,
  code: LauncherAuthErrorCode,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
}

function invalidRefreshToken(): UnauthorizedError {
  return new UnauthorizedError("Invalid or expired refresh token", {
    code: LauncherAuthErrorCode.INVALID_REFRESH_TOKEN,
  });
}

async function sessionData(
  player: LauncherPlayer,
  refreshToken: string,
  familyId: string,
): Promise<LauncherSessionData> {
  return {
    accessToken: await launcherJwtService.generate({
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
      familyId,
    }),
    expiresIn: LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    player: {
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    },
  };
}

async function requireActivePlayer(minecraftUuid: string) {
  const player = await Q.player.find({ minecraftUuid });
  if (!player) {
    throw launcherError(
      "This Minecraft account is not a Createrington member",
      403,
      LauncherAuthErrorCode.NOT_A_MEMBER,
    );
  }

  if (await Q.player.ban.isPlayerBanned(player.minecraftUuid)) {
    throw launcherError(
      "This player is banned",
      403,
      LauncherAuthErrorCode.BANNED,
    );
  }

  return player;
}

export class LauncherAuthController {
  static async challenge(_req: Request, res: Response): Promise<void> {
    const serverId = await issueLauncherChallenge();
    if (!serverId) {
      throw new TooManyRequestsError("Too many pending sign-in attempts");
    }

    respondSuccess<LauncherChallengeData>(res, {
      data: { serverId, expiresIn: CHALLENGE_TTL_SECONDS },
    });
  }

  static async verify(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: VerifyBody }>(res);

    if (!(await consumeLauncherChallenge(body.serverId))) {
      throw new UnauthorizedError("Invalid or expired challenge", {
        code: LauncherAuthErrorCode.INVALID_CHALLENGE,
      });
    }

    let profile;
    try {
      profile = await verifyMojangJoin(body.username, body.serverId);
    } catch (error) {
      logger.error("Launcher sign-in: Mojang hasJoined failed:", error);
      throw launcherError(
        "Minecraft session service is unavailable",
        503,
        LauncherAuthErrorCode.MOJANG_UNAVAILABLE,
      );
    }

    if (!profile) {
      throw new UnauthorizedError("Minecraft identity could not be verified", {
        code: LauncherAuthErrorCode.INVALID_CLAIM,
      });
    }

    let player;
    try {
      player = await requireActivePlayer(profile.uuid);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        logger.info(
          `Launcher sign-in rejected for ${profile.username} (${profile.uuid}): ${error.message}`,
        );
      }
      throw error;
    }

    const session = await launcherSessionService.createSession({
      minecraftUuid: player.minecraftUuid,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info(
      `Player ${player.minecraftUsername} (${player.minecraftUuid}) signed in via launcher`,
    );

    respondSuccess(res, {
      data: await sessionData(player, session.refreshToken, session.familyId),
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: RefreshTokenBody }>(res);

    const session = await launcherSessionService.resolveActiveSession(
      body.refreshToken,
    );

    if (!session) {
      throw invalidRefreshToken();
    }

    let player;
    try {
      player = await requireActivePlayer(session.playerMinecraftUuid);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        await launcherSessionService.revokeAllForPlayer(
          session.playerMinecraftUuid,
        );
      }
      throw error;
    }

    const refreshToken = await launcherSessionService.rotateSession(
      session,
      req.ip,
      req.headers["user-agent"],
    );

    if (!refreshToken) {
      throw invalidRefreshToken();
    }

    respondSuccess(res, {
      data: await sessionData(player, refreshToken, session.familyId),
    });
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: RefreshTokenBody }>(res);

    await launcherSessionService.revokeByToken(body.refreshToken);

    respondSuccess(res, { message: "Logged out successfully" });
  }

  static me(req: Request, res: Response): void {
    if (!req.launcherAuth) {
      throw new UnauthorizedError("Launcher authentication required", {
        code: LauncherAuthErrorCode.AUTH_REQUIRED,
      });
    }

    respondSuccess<LauncherMeData>(res, {
      data: {
        player: {
          minecraftUuid: req.launcherAuth.minecraftUuid,
          minecraftUsername: req.launcherAuth.minecraftUsername,
        },
      },
    });
  }
}
