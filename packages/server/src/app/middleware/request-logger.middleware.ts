import type { NextFunction, Request, Response } from "express";
import { httpLogger } from "@/http-logger";

const SKIP_PREFIXES = ["/health", "/assets/", "/favicon", "/trpc"];

function colorDuration(ms: number): string {
  if (ms < 100) return `\x1b[32m${ms}ms\x1b[0m`;
  if (ms < 500) return `\x1b[33m${ms}ms\x1b[0m`;
  return `\x1b[31m${ms}ms\x1b[0m`;
}

/**
 * Logs every non-skipped HTTP request to the dedicated http logger after the
 * response has been sent. tRPC procedure-level details are emitted by the
 * tRPC logging middleware; this middleware still records the transport-level
 * line (one per batch HTTP POST).
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    const userId = req.user?.discordId;
    const userTag = userId ? ` u=${userId}` : "";
    httpLogger.info(
      `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${colorDuration(ms)}${userTag}`,
    );
  });

  next();
}
