import type { RequestHandler } from "express";
import { authenticate, requireAdmin, requireUser } from "./auth.middleware";

export type AuthLevel = "public" | "user" | "admin";

const AUTH_MIDDLEWARE: Record<AuthLevel, RequestHandler[]> = {
  public: [],
  user: [authenticate, requireUser],
  admin: [authenticate, requireAdmin],
};

export function route(
  auth: AuthLevel,
  ...handlers: RequestHandler[]
): RequestHandler[] {
  return [...AUTH_MIDDLEWARE[auth], ...handlers];
}
