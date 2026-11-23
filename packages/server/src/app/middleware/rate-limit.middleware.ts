import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { createRateLimitStore } from "@/services/rate-limit";
import { isLoopbackRequest } from "./server-ip.middleware";

const AVATAR_PATH = /^\/api\/skin\/[^/]+\/avatar$/;

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

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) =>
    req.path === "/api/claude-chat/stream" ||
    req.path === "/api/health" ||
    req.path.startsWith("/api/modpacks/") ||
    AVATAR_PATH.test(req.path),
});

export const modpacksLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const skinPoseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: isLoopbackRequest,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("auth"),
});

export const launcherAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("launcher-auth"),
});

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

export const launcherPackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-pack"),
});

export const launcherContentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-content"),
});

export const launcherContentFileBatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: launcherPlayerKey,
  store: createRateLimitStore("launcher-content-file-batch"),
});

export const internalSsoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: createRateLimitStore("internal-sso"),
});

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
