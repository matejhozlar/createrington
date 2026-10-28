import type { NextFunction, Request, Response } from "express";
import { httpLogger, colorDuration } from "@/http-logger";

const SKIP_PREFIXES = [
  "/api/health",
  "/api/modpacks/",
  "/assets/",
  "/favicon",
  "/trpc",
];

const REDACTED_QUERY_KEYS = new Set(["code", "state", "token", "sig"]);

function decodeKey(rawKey: string): string {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, " ")).toLowerCase();
  } catch {
    return rawKey.toLowerCase();
  }
}

export function redactUrl(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;

  const query = url
    .slice(queryStart + 1)
    .split("&")
    .map((pair) => {
      const rawKey = pair.split("=", 1)[0];
      return REDACTED_QUERY_KEYS.has(decodeKey(rawKey))
        ? `${rawKey}=[REDACTED]`
        : pair;
    })
    .join("&");

  return `${url.slice(0, queryStart)}?${query}`;
}

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
      `[HTTP] ${req.method} ${redactUrl(req.originalUrl)} ${res.statusCode} ${colorDuration(ms)}${userTag}`,
    );
  });

  next();
}
