import type { RequestHandler } from "express";
import { authenticate, requireAdmin, requireUser } from "./auth.middleware";
import { asyncHandler } from "./async-handler";

/**
 * Authentication levels for route protection
 */
export enum AuthLevel {
  PUBLIC = "public",
  USER = "user",
  ADMIN = "admin",
}

/**
 * Middleware chains for each auth level
 */
export const authMiddleware: Record<AuthLevel, RequestHandler[]> = {
  [AuthLevel.PUBLIC]: [],
  [AuthLevel.USER]: [authenticate, requireUser],
  [AuthLevel.ADMIN]: [authenticate, requireAdmin],
};

/**
 * Wraps handler with auth middleware and async handling.
 *
 * Any middleware passed between `auth` and the final handler (e.g. multer)
 * is inserted after the auth chain and before the async-wrapped handler.
 *
 * @param auth - Authentication level required
 * @param args - Zero or more middleware functions, followed by the route handler as the last element
 * @returns Array of middleware including auth, any intermediate middleware, and the async-wrapped handler
 *
 * @example
 * // No intermediate middleware (existing usage, unchanged)
 * route(AuthLevel.USER, MyController.get)
 *
 * @example
 * // With multer in the middle
 * route(AuthLevel.USER, upload.single("image"), MyController.create)
 */
export function route(
  auth: AuthLevel,
  ...args: RequestHandler[]
): RequestHandler[] {
  const middleware = args.slice(0, -1);
  const handler = args[args.length - 1];

  return [...authMiddleware[auth], ...middleware, asyncHandler(handler)];
}

/**
 * Custom middleware chains
 */
export function customRoute(
  middleware: RequestHandler[],
  handler: RequestHandler,
): RequestHandler[] {
  return [...middleware.map((m) => asyncHandler(m)), asyncHandler(handler)];
}
