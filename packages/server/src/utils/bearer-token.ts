import type { Request } from "express";

/** Extract a JWT from a strict `Authorization: Bearer <token>` header (RFC 6750). */
export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    return undefined;
  }
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}
