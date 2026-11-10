import { redisService } from "@/services/redis";
import { OneTimeStore } from "@/services/auth/one-time-store";

const CHALLENGE_TTL_MS = 60 * 1000;

export const CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;

const challenges = new OneTimeStore<true>(redisService, {
  keyPrefix: "launcher:challenge",
  ttlMs: CHALLENGE_TTL_MS,
  tokenBytes: 20,
  maxMemoryEntries: 10_000,
});

export function issueLauncherChallenge(): Promise<string | null> {
  return challenges.issue(true);
}

export async function consumeLauncherChallenge(
  serverId: string,
): Promise<boolean> {
  return (await challenges.consume(serverId)) !== null;
}

export function __resetLauncherChallengesForTests(): void {
  challenges.clearMemory();
}
