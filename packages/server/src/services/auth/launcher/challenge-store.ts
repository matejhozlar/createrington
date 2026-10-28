import crypto from "node:crypto";
import { redisService } from "@/services/redis";

const CHALLENGE_TTL_MS = 60 * 1000;
const MAX_PENDING_CHALLENGES = 10_000;
const KEY_PREFIX = "launcher:challenge";

export const CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;

interface ChallengeRedis {
  readonly isReady: boolean;
  sendCommand(args: string[]): Promise<unknown>;
}

function newServerId(): string {
  return crypto.randomBytes(20).toString("hex");
}

function hashServerId(serverId: string): string {
  return crypto.createHash("sha256").update(serverId).digest("hex");
}

/**
 * The open sign-in challenges of the launcher: a one-time server id the
 * launcher asks for, proves a Minecraft account against, and sends back
 * within a minute. They are kept in Redis, so a challenge survives a restart
 * of the app between those two requests, and in process memory while Redis is
 * unset or cannot be reached. A challenge verifies once, whichever of the two
 * holds it: a server id is only ever put in one of them, and one Redis may
 * have taken without confirming is never handed out. One that sits in Redis
 * while Redis cannot be reached does not verify, and the launcher asks for a
 * new one.
 */
export class LauncherChallengeStore {
  private readonly memory = new Map<string, number>();

  constructor(private readonly redis: ChallengeRedis) {}

  /** Opens a challenge and answers its server id, or `null` when it has to be kept in memory and too many are open there. */
  async issue(): Promise<string | null> {
    const forRedis = newServerId();
    if (await this.putInRedis(hashServerId(forRedis))) return forRedis;

    this.pruneMemory();
    if (this.memory.size >= MAX_PENDING_CHALLENGES) return null;
    const forMemory = newServerId();
    this.memory.set(hashServerId(forMemory), Date.now() + CHALLENGE_TTL_MS);
    return forMemory;
  }

  /** Whether the server id is an open challenge. The call closes it, so a second call answers false. */
  async consume(serverId: string): Promise<boolean> {
    const hash = hashServerId(serverId);
    const wasInMemory = this.takeFromMemory(hash);
    const wasInRedis = await this.takeFromRedis(hash);
    return wasInMemory || wasInRedis;
  }

  /** Forgets every challenge kept in memory. */
  clearMemory(): void {
    this.memory.clear();
  }

  private async putInRedis(hash: string): Promise<boolean> {
    if (!this.redis.isReady) return false;
    try {
      await this.redis.sendCommand([
        "SET",
        `${KEY_PREFIX}:${hash}`,
        "1",
        "PX",
        `${CHALLENGE_TTL_MS}`,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private async takeFromRedis(hash: string): Promise<boolean> {
    if (!this.redis.isReady) return false;
    try {
      const taken = await this.redis.sendCommand([
        "GETDEL",
        `${KEY_PREFIX}:${hash}`,
      ]);
      return taken !== null && taken !== undefined;
    } catch {
      return false;
    }
  }

  private takeFromMemory(hash: string): boolean {
    const expiry = this.memory.get(hash);
    if (expiry === undefined) return false;
    this.memory.delete(hash);
    return expiry >= Date.now();
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [key, expiry] of this.memory) {
      if (expiry < now) this.memory.delete(key);
    }
  }
}

const launcherChallengeStore = new LauncherChallengeStore(redisService);

export function issueLauncherChallenge(): Promise<string | null> {
  return launcherChallengeStore.issue();
}

export function consumeLauncherChallenge(serverId: string): Promise<boolean> {
  return launcherChallengeStore.consume(serverId);
}

export function __resetLauncherChallengesForTests(): void {
  launcherChallengeStore.clearMemory();
}
