import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";
import { extractBearerToken } from "@/utils/bearer-token";

/** Per-request context injected into every tRPC procedure. */
export interface Context {
  user: JWTPayload | null;
  ip: string;
}

/**
 * Creates the tRPC context from an Express request.
 *
 * Accepts only `Authorization: Bearer <jwt>`: the `crt_access` cookie path
 * used by the Express `authenticate` middleware is intentionally NOT honored
 * here. tRPC is hit cross-origin by other apps (panel server-to-server),
 * so adding cookie auth would need a matching CSRF guard (see
 * `requireTrustedOrigin` in auth.middleware) before it's safe.
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  const token = extractBearerToken(req);

  let user: JWTPayload | null = null;

  if (token) {
    try {
      user = jwtService.verify(token);
    } catch {
      // Invalid/expired token, treat as unauthenticated
    }
  }

  return { user, ip: req.ip ?? "" };
}
