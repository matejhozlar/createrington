import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { createRateLimitStore } from "@/services/rate-limit";
import { isLoopbackRequest } from "./server-ip.middleware";

const AVATAR_PATH = /^\/api\/skin\/[^/]+\/avatar$/;

/** Shared handler for rate limit violations, logs the offending IP and returns 429 */
function rateLimitHandler(req: Request, res: Response) {
  logger.warn(`[RateLimit] IP ${req.ip} exceeded rate limit on ${req.path}`);
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
    error: {
      message: "Too many requests, please try again later.",
      statusCode: 429,
    },
  });
}

/** Global rate limiter: 600 requests per 15-minute window per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Skip long-lived SSE streams: they count as one request but stay open
  // for minutes, and the stream itself has auth + upstream gating, so the
  // per-IP bucket would otherwise burn through and throttle the admin's
  // other browsing. Also skip /api/health so high-frequency external probes
  // don't share a bucket with regular traffic from the same upstream IP.
  skip: (req) =>
    req.path === "/api/claude-chat/stream" ||
    req.path === "/api/health" ||
    req.path.startsWith("/api/modpacks/") ||
    AVATAR_PATH.test(req.path),
});

/** Changelog card limiter: 3000 requests per 15-minute window per IP, sized for one row image request per changelog entry */
export const modpacksLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Posed figure limiter: 120 requests per 15-minute window per IP, skipped for the in-process render pages */
export const skinPoseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: isLoopbackRequest,
});

/** Auth-specific rate limiter: 20 requests per 15-minute window per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("auth"),
});

/** Launcher sign-in limiter: 30 requests per 15-minute window per IP */
export const launcherAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("launcher-auth"),
});

/** Launcher update check limiter: 60 requests per 15-minute window per IP (the check is unauthenticated) */
export const launcherUpdateCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("launcher-update-check"),
});

function launcherPlayerKey(req: Request): string {
  return req.launcherAuth?.minecraftUuid ?? ipKeyGenerator(req.ip ?? "unknown");
}

/** Launcher pack limiter: 120 requests per 15-minute window per launcher player (per IP without a session), so launchers behind one NAT do not share a budget */
export const launcherPackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-pack"),
});

/** Launcher content limiter: 60 requests per minute per launcher player (per IP without a session) */
export const launcherContentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-content"),
});

/** Launcher content file batch limiter: 10 requests per 15-minute window per launcher player, on top of the content limiter, as one batch can cost 20 CurseForge calls */
export const launcherContentFileBatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-content-file-batch"),
});

// Backstop for the internal SSO code-exchange endpoint. It is internet
// exposed (skin-api is remote) and protected by the shared secret alone, so
// this caps blind brute force if that secret ever leaks. Legitimate traffic
// is server-to-server from skin-api (one IP, one call per login), so the
// per-IP limit is set well above real peak login volume.
export const internalSsoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("internal-sso"),
});

// Per-player limiter for mod-side mutating currency endpoints (deposit,
// withdraw, pay). Keyed on the authenticated minecraft UUID so a single
// compromised player JWT can't pump balance via repeated calls. Mounted
// after verifyModJWT so req.modAuth.uuid is populated.
export const modCurrencyMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request) =>
    req.modAuth?.uuid ?? ipKeyGenerator(req.ip ?? "unknown"),
  store: createRateLimitStore("mod-currency-mutation"),
});

/** Message send limiter: 20 messages per minute per user, mounted before the upload is buffered */
export const messageSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request) =>
    req.user?.discordId ?? ipKeyGenerator(req.ip ?? "unknown"),
  store: createRateLimitStore("message-send"),
});
