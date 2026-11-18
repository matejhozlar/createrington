import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/errors";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

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
