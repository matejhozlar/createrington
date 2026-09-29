import crypto from "node:crypto";

const CHALLENGE_TTL_MS = 60 * 1000;
const MAX_PENDING_CHALLENGES = 10_000;

const store = new Map<string, number>();

function hashServerId(serverId: string): string {
  return crypto.createHash("sha256").update(serverId).digest("hex");
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, expiry] of store) {
    if (expiry < now) store.delete(key);
  }
}

export const CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;

export function issueLauncherChallenge(): string | null {
  pruneExpired();
  if (store.size >= MAX_PENDING_CHALLENGES) return null;

  const serverId = crypto.randomBytes(20).toString("hex");
  store.set(hashServerId(serverId), Date.now() + CHALLENGE_TTL_MS);
  return serverId;
}

export function consumeLauncherChallenge(serverId: string): boolean {
  const hash = hashServerId(serverId);
  const expiry = store.get(hash);
  if (expiry === undefined) return false;
  store.delete(hash);
  return expiry >= Date.now();
}

export function __resetLauncherChallengesForTests(): void {
  store.clear();
}
