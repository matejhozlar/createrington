import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";

/** Per-request context injected into every tRPC procedure. */
export interface Context {
  user: JWTPayload | null;
}

/**
 * Creates the tRPC context from an Express request.
 * Extracts and verifies the JWT from the Authorization header; invalid or
 * missing tokens result in `user: null` (unauthenticated).
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader;

  let user: JWTPayload | null = null;

  if (token) {
    try {
      user = jwtService.verify(token);
    } catch {
      // Invalid/expired token — treat as unauthenticated
    }
  }

  return { user };
}
