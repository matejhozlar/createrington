import {
  MemoryStore,
  type ClientRateLimitInfo,
  type IncrementResponse,
  type Options,
  type Store,
} from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redisService } from "@/services/redis";

/**
 * Store for express-rate-limit that counts in a remote store while it is up
 * and in process memory otherwise, so a limit keeps limiting (from zero) when
 * the remote store is down and no request fails over it. The remote store is
 * built anew each time it comes back, and a remote call that fails is counted
 * in memory.
 */
export class FallbackRateLimitStore implements Store {
  readonly localKeys = false;

  private readonly memory = new MemoryStore();
  private options: Options | null = null;
  private remote: Promise<Store> | null = null;

  constructor(
    readonly prefix: string,
    private readonly isRemoteUp: () => boolean,
    private readonly createRemote: () => Store,
  ) {}

  /** Called once by express-rate-limit with the limiter's options. */
  init(options: Options): void {
    this.options = options;
    this.memory.init(options);
  }

  /** The hits and reset time of a client, from whichever store is in use. */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    return this.run(
      (remote) => remote.get?.(key),
      () => this.memory.get(key),
    );
  }

  /** Counts one hit for a client in whichever store is in use. */
  async increment(key: string): Promise<IncrementResponse> {
    return this.run(
      (remote) => remote.increment(key),
      () => this.memory.increment(key),
    );
  }

  /** Takes one hit of a client back. */
  async decrement(key: string): Promise<void> {
    return this.run(
      (remote) => remote.decrement(key),
      () => this.memory.decrement(key),
    );
  }

  /** Forgets the hits of a client in both stores. */
  async resetKey(key: string): Promise<void> {
    await this.memory.resetKey(key);
    await this.run(
      (remote) => remote.resetKey(key),
      () => undefined,
    );
  }

  /** Stops the memory store's timer. */
  shutdown(): void {
    this.memory.shutdown();
  }

  private async run<T>(
    onRemote: (remote: Store) => Promise<T> | T,
    onMemory: () => Promise<T> | T,
  ): Promise<T> {
    if (!this.options || !this.isRemoteUp()) {
      this.remote = null;
      return onMemory();
    }

    try {
      this.remote ??= this.openRemote(this.options);
      return await onRemote(await this.remote);
    } catch {
      this.remote = null;
      return onMemory();
    }
  }

  private async openRemote(options: Options): Promise<Store> {
    const remote = this.createRemote();
    await remote.init?.(options);
    return remote;
  }
}

/**
 * The store for a rate limiter with this name: Redis with memory behind it
 * when Redis is configured, so the limit survives a restart of the app.
 * `undefined` without Redis, which leaves the limiter on its own memory store.
 */
export function createRateLimitStore(name: string): Store | undefined {
  if (!redisService.enabled) return undefined;

  const prefix = `rate-limit:${name}:`;
  return new FallbackRateLimitStore(
    prefix,
    () => redisService.isReady,
    () =>
      new RedisStore({
        prefix,
        sendCommand: (...args: string[]) =>
          redisService.sendCommand(args) as Promise<RedisReply>,
      }),
  );
}
