import type { NextFunction, Request, Response } from "express";
import {
  LAUNCHER_PLATFORM_HEADER,
  LAUNCHER_VERSION_HEADER,
  LauncherAuthErrorCode,
} from "@createrington/shared/launcher";
import { AppError } from "./error-handler";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";

const HTTP_UPGRADE_REQUIRED = 426;

export const requireSupportedLauncher = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const platform = req.get(LAUNCHER_PLATFORM_HEADER);
  const version = req.get(LAUNCHER_VERSION_HEADER);
  if (!platform || !version) {
    next();
    return;
  }

  let outdated = false;
  try {
    outdated = await launcherReleaseService.isUpdateRequired(platform, version);
  } catch (error) {
    logger.warn(
      "Launcher version check failed, letting the request through:",
      error,
    );
  }

  if (outdated) {
    next(
      new AppError(
        "This version of the launcher is no longer supported. Update the launcher to continue.",
        HTTP_UPGRADE_REQUIRED,
        true,
        undefined,
        { code: LauncherAuthErrorCode.UPDATE_REQUIRED },
      ),
    );
    return;
  }

  next();
};
