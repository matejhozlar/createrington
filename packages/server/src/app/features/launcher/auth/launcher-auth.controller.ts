import type { Request, Response } from "express";
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
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";
import { verifyMojangJoin } from "@/utils/mojang-has-joined";
import type { RefreshTokenBody, VerifyBody } from "./launcher-auth.schemas";

export const LauncherAuthErrorCode = {
  INVALID_CHALLENGE: "INVALID_CHALLENGE",
  INVALID_CLAIM: "INVALID_CLAIM",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  BANNED: "BANNED",
  INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",
  MOJANG_UNAVAILABLE: "MOJANG_UNAVAILABLE",
} as const;

function launcherError(
  message: string,
  statusCode: number,
  code: string,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
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

    res.json({
      success: true,
      data: { serverId, expiresIn: CHALLENGE_TTL_SECONDS },
    });
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

    res.json({
      success: true,
      data: {
        accessToken: launcherJwtService.generate(player),
        refreshToken,
        player: {
          minecraftUuid: player.minecraftUuid,
          minecraftUsername: player.minecraftUsername,
        },
      },
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: RefreshTokenBody }>(res);

    const result = await launcherSessionService.rotateToken(
      body.refreshToken,
      req.clientIp || req.ip,
      req.headers["user-agent"],
    );

    if (!result) {
      throw new UnauthorizedError("Invalid or expired refresh token", {
        code: LauncherAuthErrorCode.INVALID_REFRESH_TOKEN,
      });
    }

    let player;
    try {
      player = await requireActivePlayer(result.minecraftUuid);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        await launcherSessionService.revokeAllForPlayer(result.minecraftUuid);
      }
      throw error;
    }

    res.json({
      success: true,
      data: {
        accessToken: launcherJwtService.generate(player),
        refreshToken: result.rawToken,
        player: {
          minecraftUuid: player.minecraftUuid,
          minecraftUsername: player.minecraftUsername,
        },
      },
    });
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: RefreshTokenBody }>(res);

    await launcherSessionService.revokeByToken(body.refreshToken);

    res.json({ success: true, message: "Logged out successfully" });
  }

  static async me(req: Request, res: Response): Promise<void> {
    if (!req.launcherAuth) {
      throw new UnauthorizedError("Launcher authentication required");
    }

    res.json({ success: true, data: { player: req.launcherAuth } });
  }
}
