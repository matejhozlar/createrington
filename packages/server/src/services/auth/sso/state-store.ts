import { redisService } from "@/services/redis";
import { OneTimeStore } from "@/services/auth/one-time-store";

/**
 * State tokens of the server-driven SSO flow. Each carries the validated
 * `return_to` so the consent step and its completion know where to send the
 * user once they authorize. The TTL is 15 minutes because the flow can route
 * a logged-out user through a full Discord login before they reach the
 * consent screen.
 */
const states = new OneTimeStore<{ returnTo: string }>(redisService, {
  keyPrefix: "auth:sso:state",
  ttlMs: 15 * 60 * 1000,
  tokenBytes: 32,
  maxMemoryEntries: 10_000,
});

/** Mint a fresh state token bound to the validated return_to. Null when too many are open in memory. */
export function issueSsoState(returnTo: string): Promise<string | null> {
  return states.issue({ returnTo });
}

/** Read the return_to for a state without consuming it (used by the consent screen). Null if unknown or expired. */
export function peekSsoState(
  state: string,
): Promise<{ returnTo: string } | null> {
  return states.peek(state);
}

/** Consume a state token, returning its return_to once. Null if unknown, expired or already consumed. */
export function consumeSsoState(
  state: string,
): Promise<{ returnTo: string } | null> {
  return states.consume(state);
}
