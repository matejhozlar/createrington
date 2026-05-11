import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "./error-handler";

/**
 * Allowed Minecraft server IPs
 */
const ALLOWED_IPS = {
  development: ["127.0.0.1", "::1", "localhost"],
  production: [config.servers.cogs.ip],
};

/**
 * Extract the true client IP for the mod-API allowlist.
 *
 * When the immediate TCP peer is localhost we are terminating behind our own
 * nginx, which unconditionally overwrites `X-Real-IP` with `$remote_addr`.
 * Combined with `real_ip_header CF-Connecting-IP` + the Cloudflare subnet
 * allowlist in nginx, `$remote_addr` has already been rewritten to the true
 * originating client IP before it reaches this header, so `X-Real-IP` on
 * a loopback request is safe to trust.
 *
 * We deliberately ignore `X-Forwarded-For`: nginx uses
 * `$proxy_add_x_forwarded_for` which APPENDS to any XFF the client sent,
 * leaving the leftmost entries attacker-controlled.
 *
 * When the peer is NOT localhost, something other than our nginx is talking
 * to the Node process (e.g. a direct connection from the Minecraft host).
 * In that case we trust only the raw socket peer and ignore all headers.
 */
function getClientIp(req: Request): string {
  const peer = req.socket.remoteAddress ?? "";
  const normalizedPeer = normalizeIp(peer);

  if (normalizedPeer === "127.0.0.1" || normalizedPeer === "::1") {
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.length > 0) {
      return realIp.trim();
    }
  }

  return peer || "unknown";
}

/**
 * Normalize an IP address for comparison, stripping IPv6-mapped IPv4 prefixes
 *
 * @param ip - Raw IP address string
 * @returns Normalized IP address suitable for allowlist comparison
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
 * Check whether an IP address is in the allowlist for the given environment
 *
 * @param ip - IP address to check
 * @param environment - Target environment whose allowlist is used
 * @returns True if the IP is allowed, false otherwise
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
