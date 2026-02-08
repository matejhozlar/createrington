import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";

export interface Context {
  user: JWTPayload | null;
}

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
