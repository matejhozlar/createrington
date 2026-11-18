import config from "@/config";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "./error-handler";

const ALLOWED_IPS = {
  development: () => ["127.0.0.1", "::1"],
  production: () => [config.servers.rails.ip],
};

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

function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  return ip;
}

export const verifyServerIP = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const clientIp = getClientIp(req);
    const normalizedIp = normalizeIp(clientIp);

    const environment = config.envMode.isProd ? "production" : "development";
    const allowedIps = ALLOWED_IPS[environment]();

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

function inspectPeer(req: Request) {
  const peer = normalizeIp(req.socket.remoteAddress ?? "");
  const proxied = req.headers["x-forwarded-for"] !== undefined;
  const isLoopback = (peer === "127.0.0.1" || peer === "::1") && !proxied;
  return { peer, proxied, isLoopback };
}

export function isLoopbackRequest(req: Request): boolean {
  return inspectPeer(req).isLoopback;
}

export const requireLoopback = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const { peer, proxied, isLoopback } = inspectPeer(req);
  if (isLoopback) {
    next();
    return;
  }
  logger.warn(
    `Rejected non-loopback request to ${req.originalUrl} (peer=${peer}, proxied=${proxied})`,
  );
  next(new ForbiddenError("Loopback only"));
};
