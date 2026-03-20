import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "./error-handler";

/**
 * Verify the X-Sync-Secret header matches the configured playtime sync secret.
 *
 * Used to authenticate cross-environment playtime forwarding requests.
 *
 * @throws {UnauthorizedError} if the secret is missing or invalid
 */
export const verifySyncSecret = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const secret = req.headers["x-sync-secret"];

  if (!config.sync.secret) {
    next(new UnauthorizedError("Playtime sync is not configured"));
    return;
  }

  if (secret !== config.sync.secret) {
    logger.warn("Invalid sync secret received on internal presence endpoint");
    next(new UnauthorizedError("Invalid sync secret"));
    return;
  }

  next();
};
