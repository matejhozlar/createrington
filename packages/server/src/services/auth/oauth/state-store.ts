import { redisService } from "@/services/redis";
import { OneTimeStore } from "@/services/auth/one-time-store";

export const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

const states = new OneTimeStore<true>(redisService, {
  keyPrefix: "auth:oauth:state",
  ttlMs: OAUTH_STATE_TTL_MS,
  tokenBytes: 32,
  maxMemoryEntries: 10_000,
});

/** Mint the state token of a Discord OAuth login. Null when too many are open in memory. */
export function issueOAuthState(): Promise<string | null> {
  return states.issue(true);
}

/** Whether the state is an open Discord OAuth login. The call closes it, so a second call answers false. */
export async function consumeOAuthState(state: string): Promise<boolean> {
  return (await states.consume(state)) !== null;
}
