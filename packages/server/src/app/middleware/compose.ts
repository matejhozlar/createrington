import type { RequestHandler } from "express";
import { authenticate, requireAdmin, requireUser } from "./auth.middleware";
import { asyncHandler } from "./async-handler";

/**
 * Authentication levels for route protection
 */
export type AuthLevel = "public" | "user" | "admin";

/**
 * Middleware chains for each auth level
 */
export const authMiddleware: Record<AuthLevel, RequestHandler[]> = {
  ["public"]: [],
  ["user"]: [authenticate, requireUser],
  ["admin"]: [authenticate, requireAdmin],
};

/**
 * Wraps handler with auth middleware and async handling
 *
 * Any middleware passed between `auth` and the final handler is inserted
 * after the auth chain and before the async-wrapper handlers
 *
 * All middleware and handlers are automatically wrapped with asyncHandler
 * to catch errors and pass them to the error handler
 *
 * @param auth - Authentication level required
 * @param args - Zero or more middleware functions, followed by the route handler as the last element
 * @returns Array of middleware including auth, any intermediate middleware, and the async-wrapped handler
 *
 * @example
 * // No intermediate middleware
 * route(AuthLevel.PUBLIC, MyController.get)
 *
 * @example
 * // With validation middleware
 * route(
 *   AuthLevel.USER,
 *   validate({ params: GetPlayerParamsSchema }),
 *   MyController.getPlayer
 * )
 *
 * @example
 * // With multiple middleware (validation + multer)
 * route(
 *   AuthLevel.USER,
 *   validate({ body: SendMessageBodySchema }),
 *   upload.single("image"),
 *   MyController.sendMessage
 * )
 */
export function route(
  auth: AuthLevel,
  ...args: RequestHandler[]
): RequestHandler[] {
  const middleware = args.slice(0, -1);
  const handler = args[args.length - 1];

  return [
    ...authMiddleware[auth],
    ...middleware.map((m) => asyncHandler(m)),
    asyncHandler(handler),
  ];
}

/**
 * Custom middleware chains
 *
 * Usage:
 * - When complete control over the middleware chain is needed
 * without automatic auth middleware
 *
 * @param middleware - Array of middleware functions
 * @param handler - Route handler functions
 * @returns Array of async-wrapped middleware and handler
 *
 * @example
 * customRoute(
 *   [verifyServerIP, verifyModJWT],
 *   PresenceController.updatePresence
 * )
 */
export function customRoute(
  middleware: RequestHandler[],
  handler: RequestHandler,
): RequestHandler[] {
  return [...middleware.map((m) => asyncHandler(m)), asyncHandler(handler)];
}
