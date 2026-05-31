import crypto from "node:crypto";

/**
 * In-memory store for the server-driven SSO flow, keyed by a fresh state
 * token. Each entry carries the validated `return_to` so the consent step and
 * its completion know where to send the user once they authorize.
 *
 * The TTL is generous (15m) because the flow can now route a logged-out user
 * through a full Discord login before they reach the consent screen; a short
 * window would expire the state mid-login. Single main-app process, tiny
 * payloads, so a Map matches the OAuth-state precedent in code-store.ts. If
 * main app ever goes multi-instance, migrate this alongside the other stores.
 */
const store = new Map<string, { expiry: number; returnTo: string }>();

const STATE_TTL_MS = 15 * 60 * 1000;

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiry < now) store.delete(key);
  }
}

/** Mint a fresh state token bound to the validated return_to. */
export function issueSsoState(returnTo: string): string {
  const state = crypto.randomBytes(32).toString("hex");
  store.set(state, { expiry: Date.now() + STATE_TTL_MS, returnTo });
  pruneExpired();
  return state;
}

/** Read the return_to for a state without consuming it (used by the consent screen). Null if unknown or expired. */
export function peekSsoState(state: string): { returnTo: string } | null {
  pruneExpired();
  const entry = store.get(state);
  if (!entry) return null;
  if (entry.expiry < Date.now()) {
    store.delete(state);
    return null;
  }
  return { returnTo: entry.returnTo };
}

/** Consume a state token, returning its return_to once then deleting it. Null if unknown or expired. */
export function consumeSsoState(state: string): { returnTo: string } | null {
  pruneExpired();
  const entry = store.get(state);
  if (!entry) return null;
  store.delete(state);
  if (entry.expiry < Date.now()) return null;
  return { returnTo: entry.returnTo };
}
