import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import config from "@/config";
import { jwtService } from "@/services/auth/jwt";
import type { JWTPayload } from "@createrington/shared/auth";
import { extractBearerToken } from "@/app/utils/bearer-token";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

export interface Context {
  user: JWTPayload | null;
  service: "sandbox" | null;
  ip: string;
}

function isSandboxServiceToken(token: string): boolean {
  const expected = config.sandbox.serviceToken;
  return expected !== null && timingSafeEqualStrings(token, expected);
}

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
      user = await jwtService.verify(token);
    } catch {}
  }

  return { user, service, ip: req.ip ?? "" };
}
