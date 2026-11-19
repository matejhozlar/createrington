import config from "@/config";
import type { RequestHandler } from "express";
import { UnauthorizedError } from "@/errors";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

export function requireHeaderSecret(
  header: string,
  secret: () => string | null | undefined,
  label: string,
): RequestHandler {
  return (req, _res, next) => {
    const provided = req.headers[header];
    const expected = secret();
    if (
      typeof provided !== "string" ||
      !expected ||
      !timingSafeEqualStrings(provided, expected)
    ) {
      logger.warn(`Invalid ${label} received on ${req.baseUrl}${req.path}`);
      next(new UnauthorizedError(`Invalid ${label}`));
      return;
    }
    next();
  };
}

export const verifySyncSecret = requireHeaderSecret(
  "x-sync-secret",
  () => config.sync.secret,
  "sync secret",
);

export const verifyInternalSecret = requireHeaderSecret(
  "x-internal-secret",
  () => config.internal.secret,
  "internal secret",
);
