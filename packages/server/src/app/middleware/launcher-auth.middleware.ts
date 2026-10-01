import type { NextFunction, Request, Response } from "express";
import { LauncherAuthErrorCode } from "@createrington/shared/launcher";
import { UnauthorizedError } from "./error-handler";
import {
  LauncherTokenExpiredError,
  launcherJwtService,
} from "@/services/auth/launcher/launcher-jwt.service";
import { extractBearerToken } from "@/utils/bearer-token";

export const authenticateLauncher = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = extractBearerToken(req);

  if (!token) {
    next(
      new UnauthorizedError("Launcher authentication required", {
        code: LauncherAuthErrorCode.AUTH_REQUIRED,
      }),
    );
    return;
  }

  try {
    req.launcherAuth = launcherJwtService.verify(token);
    next();
  } catch (error) {
    next(
      error instanceof LauncherTokenExpiredError
        ? new UnauthorizedError("Launcher token expired", {
            code: LauncherAuthErrorCode.TOKEN_EXPIRED,
          })
        : new UnauthorizedError("Invalid launcher token", {
            code: LauncherAuthErrorCode.INVALID_TOKEN,
          }),
    );
  }
};
