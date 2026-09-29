import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "./error-handler";
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";
import { extractBearerToken } from "@/utils/bearer-token";

export const authenticateLauncher = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = extractBearerToken(req);

  if (!token) {
    next(new UnauthorizedError("Launcher authentication required"));
    return;
  }

  try {
    req.launcherAuth = launcherJwtService.verify(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
};
