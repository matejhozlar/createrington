import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import config from "@/config";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";
import { extractBearerToken } from "@/utils/bearer-token";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

/** Per-request context injected into every tRPC procedure. */
export interface Context {
  user: JWTPayload | null;
  /** Set when the bearer token is a consumer's service secret instead of a user JWT. */
  service: "sandbox" | null;
  ip: string;
}

function isSandboxServiceToken(token: string): boolean {
  const expected = config.sandbox.serviceToken;
  return expected !== null && timingSafeEqualStrings(token, expected);
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
  let service: Context["service"] = null;

  if (token && isSandboxServiceToken(token)) {
    service = "sandbox";
  } else if (token) {
    try {
      user = jwtService.verify(token);
    } catch {
      // Invalid/expired token, treat as unauthenticated
    }
  }

  return { user, service, ip: req.ip ?? "" };
}
