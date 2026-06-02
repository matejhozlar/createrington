import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

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
    req.path === "/api/claude-chat/stream" || req.path === "/api/health",
});

/** Auth-specific rate limiter: 20 requests per 15-minute window per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
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
});
