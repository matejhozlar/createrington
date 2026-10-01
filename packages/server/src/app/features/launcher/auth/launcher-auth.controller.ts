import type { Request, Response } from "express";
import {
  LauncherAuthErrorCode,
  type LauncherChallengeData,
  type LauncherLogoutResponse,
  type LauncherMeData,
  type LauncherSessionData,
  type LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import {
  AppError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/app/middleware/error-handler";
import { getValidated } from "@/app/middleware/validation.middleware";
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
import { verifyMojangJoin } from "@/utils/mojang-has-joined";
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

function sessionResponse(
  player: { minecraftUuid: string; minecraftUsername: string },
  refreshToken: string,
): LauncherSuccessResponse<LauncherSessionData> {
  return {
    success: true,
    data: {
      accessToken: launcherJwtService.generate(player),
      expiresIn: LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      player: {
        minecraftUuid: player.minecraftUuid,
        minecraftUsername: player.minecraftUsername,
      },
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
    const serverId = issueLauncherChallenge();
    if (!serverId) {
      throw new TooManyRequestsError("Too many pending sign-in attempts");
    }

    const body: LauncherSuccessResponse<LauncherChallengeData> = {
      success: true,
      data: { serverId, expiresIn: CHALLENGE_TTL_SECONDS },
    };
    res.json(body);
  }

  static async verify(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: VerifyBody }>(res);

    if (!consumeLauncherChallenge(body.serverId)) {
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

    const player = await requireActivePlayer(profile.uuid);

    const refreshToken = await launcherSessionService.createSession({
      minecraftUuid: player.minecraftUuid,
      ip: req.clientIp || req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info(
      `Player ${player.minecraftUsername} (${player.minecraftUuid}) signed in via launcher`,
    );

    res.json(sessionResponse(player, refreshToken));
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
      req.clientIp || req.ip,
      req.headers["user-agent"],
    );

    if (!refreshToken) {
      throw invalidRefreshToken();
    }

    res.json(sessionResponse(player, refreshToken));
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: RefreshTokenBody }>(res);

    await launcherSessionService.revokeByToken(body.refreshToken);

    const response: LauncherLogoutResponse = {
      success: true,
      message: "Logged out successfully",
    };
    res.json(response);
  }

  static async me(req: Request, res: Response): Promise<void> {
    if (!req.launcherAuth) {
      throw new UnauthorizedError("Launcher authentication required", {
        code: LauncherAuthErrorCode.AUTH_REQUIRED,
      });
    }

    const body: LauncherSuccessResponse<LauncherMeData> = {
      success: true,
      data: {
        player: {
          minecraftUuid: req.launcherAuth.minecraftUuid,
          minecraftUsername: req.launcherAuth.minecraftUsername,
        },
      },
    };
    res.json(body);
  }
}
