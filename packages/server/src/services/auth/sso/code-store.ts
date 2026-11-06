import { redisService } from "@/services/redis";
import { OneTimeStore } from "@/services/auth/one-time-store";

/**
 * Identity payload carried by a one-time SSO code. Mirrors what main app knows
 * about a player at the moment of a successful Discord OAuth round-trip; the
 * consumer (skin-api) trusts this verbatim, so it must contain only values
 * main app has already authenticated.
 */
export interface SsoCodePayload {
  playerId: string;
  minecraftUsername: string;
  isMember: boolean;
  isOwner: boolean;
}

const codes = new OneTimeStore<SsoCodePayload>(redisService, {
  keyPrefix: "auth:sso:code",
  ttlMs: 60 * 1000,
  tokenBytes: 32,
  maxMemoryEntries: 10_000,
});

/** Mint a single-use code for the payload, valid for 60s. Null when too many are open in memory. */
export function issueSsoCode(payload: SsoCodePayload): Promise<string | null> {
  return codes.issue(payload);
}

/** Redeem a code: returns the payload once. Null if unknown, expired or already redeemed. */
export function consumeSsoCode(code: string): Promise<SsoCodePayload | null> {
  return codes.consume(code);
}
