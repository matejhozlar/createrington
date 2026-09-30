import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import config from "@/config";
import { extractBearerToken } from "@/utils/bearer-token";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";
import { NotFoundError, UnauthorizedError } from "./error-handler";

export const requireDirectRequest = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (
    req.headers["x-forwarded-for"] !== undefined ||
    req.headers["x-real-ip"] !== undefined
  ) {
    logger.warn(
      `Refused proxied request to internal launcher route ${req.method} ${req.originalUrl}`,
    );
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
    return;
  }

  next();
};

export const verifyLauncherPublishToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = extractBearerToken(req);
  const expectedHash = config.launcher.publishTokenHash;

  if (
    !token ||
    !expectedHash ||
    !timingSafeEqualStrings(
      crypto.createHash("sha256").update(token).digest("hex"),
      expectedHash,
    )
  ) {
    logger.warn("Invalid launcher publish token received");
    next(new UnauthorizedError("Invalid publish token"));
    return;
  }

  next();
};
