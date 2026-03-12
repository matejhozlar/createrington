import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/** Shared handler for rate limit violations — logs the offending IP and returns 429 */
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

/** Global rate limiter — 200 requests per 15-minute window per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Auth-specific rate limiter — 20 requests per 15-minute window per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});
