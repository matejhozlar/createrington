import crypto from "node:crypto";

interface OneTimeStoreRedis {
  readonly isReady: boolean;
  sendCommand(args: string[]): Promise<unknown>;
}

export interface OneTimeStoreOptions {
  keyPrefix: string;
  ttlMs: number;
  tokenBytes: number;
  maxMemoryEntries: number;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Values handed out under one-time random tokens that expire after `ttlMs`.
 * They are kept in Redis under `<keyPrefix>:<sha256 of the token>`, so a token
 * survives a restart of the app and the raw token never sits in Redis, and in
 * process memory while Redis is unset or cannot be reached, where at most
 * `maxMemoryEntries` are open at once. A token is taken once, whichever of the
 * two holds it: a token is only ever put in one of them, and one Redis may
 * have stored without confirming is never handed out. One that sits in Redis
 * while Redis cannot be reached is not found until Redis is back.
 */
export class OneTimeStore<T> {
  private readonly memory = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly redis: OneTimeStoreRedis,
    private readonly options: OneTimeStoreOptions,
  ) {}

  /** Stores the value under a new token and answers the token, or `null` when it has to be kept in memory and too many are open there. */
  async issue(value: T): Promise<string | null> {
    const forRedis = this.newToken();
    if (await this.putInRedis(hashToken(forRedis), value)) return forRedis;

    this.pruneMemory();
    if (this.memory.size >= this.options.maxMemoryEntries) return null;
    const forMemory = this.newToken();
    this.memory.set(hashToken(forMemory), {
      value,
      expiresAt: Date.now() + this.options.ttlMs,
    });
    return forMemory;
  }

  /** The value under the token without taking it, or `null` when there is none or its time is up. */
  async peek(token: string): Promise<T | null> {
    const hash = hashToken(token);
    const entry = this.memory.get(hash);
    if (entry) {
      if (entry.expiresAt >= Date.now()) return entry.value;
      this.memory.delete(hash);
      return null;
    }
    return this.readFromRedis("GET", hash);
  }

  /** The value under the token, or `null` when there is none or its time is up. The call takes it, so a second call answers `null`. */
  async consume(token: string): Promise<T | null> {
    const hash = hashToken(token);
    const fromMemory = this.takeFromMemory(hash);
    const fromRedis = await this.readFromRedis("GETDEL", hash);
    return fromMemory ?? fromRedis;
  }

  /** Forgets every token kept in memory. */
  clearMemory(): void {
    this.memory.clear();
  }

  private newToken(): string {
    return crypto.randomBytes(this.options.tokenBytes).toString("hex");
  }

  private key(hash: string): string {
    return `${this.options.keyPrefix}:${hash}`;
  }

  private async putInRedis(hash: string, value: T): Promise<boolean> {
    if (!this.redis.isReady) return false;
    try {
      await this.redis.sendCommand([
        "SET",
        this.key(hash),
        JSON.stringify(value),
        "PX",
        `${this.options.ttlMs}`,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private async readFromRedis(
    command: "GET" | "GETDEL",
    hash: string,
  ): Promise<T | null> {
    if (!this.redis.isReady) return null;
    let reply: unknown;
    try {
      reply = await this.redis.sendCommand([command, this.key(hash)]);
    } catch {
      return null;
    }
    if (typeof reply !== "string") return null;
    try {
      return JSON.parse(reply) as T;
    } catch {
      logger.warn(
        `One-time store found an unreadable value under ${this.options.keyPrefix}`,
      );
      return null;
    }
  }

  private takeFromMemory(hash: string): T | null {
    const entry = this.memory.get(hash);
    if (!entry) return null;
    this.memory.delete(hash);
    return entry.expiresAt >= Date.now() ? entry.value : null;
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [hash, entry] of this.memory) {
      if (entry.expiresAt < now) this.memory.delete(hash);
    }
  }
}
