import type { NextFunction, Request, Response } from "express";
import { LauncherAuthErrorCode } from "@createrington/shared/launcher";
import { UnauthorizedError } from "./error-handler";
import {
  LauncherTokenExpiredError,
  launcherJwtService,
  type LauncherJwtPayload,
} from "@/services/auth/launcher/launcher-jwt.service";
import { isLauncherTokenDenied } from "@/services/auth/launcher/launcher-token-denylist";
import { extractBearerToken } from "@/utils/bearer-token";

function invalidToken(): UnauthorizedError {
  return new UnauthorizedError("Invalid launcher token", {
    code: LauncherAuthErrorCode.INVALID_TOKEN,
  });
}

export const authenticateLauncher = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = extractBearerToken(req);

  if (!token) {
    next(
      new UnauthorizedError("Launcher authentication required", {
        code: LauncherAuthErrorCode.AUTH_REQUIRED,
      }),
    );
    return;
  }

  let payload: LauncherJwtPayload;
  try {
    payload = launcherJwtService.verify(token);
  } catch (error) {
    next(
      error instanceof LauncherTokenExpiredError
        ? new UnauthorizedError("Launcher token expired", {
            code: LauncherAuthErrorCode.TOKEN_EXPIRED,
          })
        : invalidToken(),
    );
    return;
  }

  if (await isLauncherTokenDenied(payload)) {
    next(invalidToken());
    return;
  }

  req.launcherAuth = payload;
  next();
};
