import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "./error-handler";

/**
 * Allowed Minecraft server IPs
 */
const ALLOWED_IPS = {
  development: ["127.0.0.1", "::1", "localhost"],
  production: [config.app.auth.allowedServerIps.local],
};

/**
 * Extract real IP from the request
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(".")[0];
    return ips.trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string") {
    return realIp.trim();
  }

  return req.socket.remoteAddress || "unknown";
}

/**
 * Normalize IP address for comparison
 * Handles IPv6-mapped IPv4 addresses
 */
function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  if (ip === ":1") {
    return "127.0.0.1";
  }

  return ip;
}

/**
 * Verify request is from an allowed Minecraft server IP
 *
 * Checks request IP against environment-specific whitelist
 * Supports both development and production environments
 *
 * @throws {ForbiddenError} If IP is not in the allowed list
 */
export const verifyServerIP = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const clientIp = getClientIp(req);
    const normalizedIp = normalizeIp(clientIp);

    const environment = config.envMode.isProd ? "production" : "development";
    const allowedIps = ALLOWED_IPS[environment];

    const isAllowed = allowedIps.some(
      (allowedIp) => normalizeIp(allowedIp) === normalizedIp,
    );

    if (!isAllowed) {
      logger.warn(
        `Unauthorized server IP attempted to access presence API: ${clientIp} (normalized: ${normalizedIp})`,
      );
      throw new ForbiddenError("Server IP not authorized");
    }

    logger.debug(
      `Verified server IP: ${clientIp} (${environment} environment)`,
    );

    req.serverIp = normalizedIp;

    next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      next(error);
    } else {
      logger.error("IP verification failed:", error);
      next(new ForbiddenError("IP verification failed"));
    }
  }
};

/**
 * Helper to check if an IP is allowed (for testing/debugging)
 */
export function isIpAllowed(
  ip: string,
  environment: "development" | "production",
): boolean {
  const normalizedIp = normalizeIp(ip);
  const allowedIps = ALLOWED_IPS[environment];
  return allowedIps.some(
    (allowedIp) => normalizeIp(allowedIp) === normalizedIp,
  );
}
