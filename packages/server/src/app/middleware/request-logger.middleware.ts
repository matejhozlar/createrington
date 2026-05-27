import type { NextFunction, Request, Response } from "express";
import { httpLogger, colorDuration } from "@/http-logger";

const SKIP_PREFIXES = ["/api/health", "/assets/", "/favicon", "/trpc"];

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
