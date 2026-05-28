import crypto from "node:crypto";

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

const CODE_TTL_MS = 60 * 1000;

/**
 * In-memory store keyed by sha256(code). Single main-app process, 60s TTL,
 * tiny payloads, so a Map matches the existing OAuth-state precedent in
 * auth.controller.ts. If main app ever goes multi-instance, migrate this
 * alongside the other OAuth-state Maps.
 */
const store = new Map<string, { expiry: number; payload: SsoCodePayload }>();

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiry < now) store.delete(key);
  }
}

/** Mint a single-use code for the payload and store its hash with a 60s TTL. */
export function issueSsoCode(payload: SsoCodePayload): string {
  const code = crypto.randomBytes(32).toString("hex");
  store.set(hashCode(code), { expiry: Date.now() + CODE_TTL_MS, payload });
  pruneExpired();
  return code;
}

/** Redeem a code: returns the payload once, then deletes it. Null if unknown or expired. */
export function consumeSsoCode(code: string): SsoCodePayload | null {
  pruneExpired();
  const hash = hashCode(code);
  const entry = store.get(hash);
  if (!entry) return null;
  store.delete(hash);
  if (entry.expiry < Date.now()) return null;
  return entry.payload;
}
