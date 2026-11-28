import { SignJWT } from "jose";

export interface TestJwtOptions {
  audience?: string;
  subject?: string;
  expiresInSeconds?: number;
}

export function signTestJwt(
  payload: object,
  secret: string,
  options: TestJwtOptions = {},
): Promise<string> {
  const claims = payload as Record<string, unknown>;
  const iat =
    typeof claims.iat === "number" ? claims.iat : Math.floor(Date.now() / 1000);
  const token = new SignJWT({ ...payload, iat }).setProtectedHeader({
    alg: "HS256",
    typ: "JWT",
  });
  if (options.audience) token.setAudience(options.audience);
  if (options.subject) token.setSubject(options.subject);
  if (options.expiresInSeconds !== undefined) {
    token.setExpirationTime(iat + options.expiresInSeconds);
  }
  return token.sign(new TextEncoder().encode(secret));
}
