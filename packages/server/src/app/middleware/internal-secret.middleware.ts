import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "./error-handler";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

/**
 * Verify the X-Internal-Secret header matches the configured internal API
 * shared secret.
 *
 * Authenticates server-to-server calls from skin-api to /api/internal/*
 * (sso-exchange, player-exists). Separate trust boundary from the playtime
 * sync secret.
 *
 * @throws {UnauthorizedError} if the secret is missing or invalid
 */
export const verifyInternalSecret = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const secret = req.headers["x-internal-secret"];

  if (
    typeof secret !== "string" ||
    !config.internal.secret ||
    !timingSafeEqualStrings(secret, config.internal.secret)
  ) {
    logger.warn("Invalid internal secret received on internal API endpoint");
    next(new UnauthorizedError("Invalid internal secret"));
    return;
  }

  next();
};
