import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/errors";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

export const verifySyncSecret = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const secret = req.headers["x-sync-secret"];

  if (
    typeof secret !== "string" ||
    !config.sync.secret ||
    !timingSafeEqualStrings(secret, config.sync.secret)
  ) {
    logger.warn("Invalid sync secret received on internal presence endpoint");
    next(new UnauthorizedError("Invalid sync secret"));
    return;
  }

  next();
};
