import type { RequestHandler } from "express";
import { authenticate, requireAdmin, requireUser } from "./auth.middleware";
import { asyncHandler } from "./async-handler";

export type AuthLevel = "public" | "user" | "admin";

export const authMiddleware: Record<AuthLevel, RequestHandler[]> = {
  ["public"]: [],
  ["user"]: [authenticate, requireUser],
  ["admin"]: [authenticate, requireAdmin],
};

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

export function customRoute(
  middleware: RequestHandler[],
  handler: RequestHandler,
): RequestHandler[] {
  return [...middleware.map((m) => asyncHandler(m)), asyncHandler(handler)];
}
