import { createClient } from "@redis/client";
import config from "@/config";

const CONNECT_TIMEOUT_MS = 2000;
const COMMAND_TIMEOUT_MS = 1000;
const PING_INTERVAL_MS = 2000;
const SILENT_CONNECTION_TIMEOUT_MS = 5000;
const UNANSWERED_PAUSE_MS = COMMAND_TIMEOUT_MS + SILENT_CONNECTION_TIMEOUT_MS;
const RECONNECT_STEP_MS = 200;
const MAX_RECONNECT_DELAY_MS = 5000;
const FAILURE_LOG_INTERVAL_MS = 60_000;

interface RedisClient {
  readonly isReady: boolean;
  readonly isOpen: boolean;
  sendCommand(args: string[]): Promise<unknown>;
  destroy(): void;
}

class RedisUnansweredError extends Error {
  constructor() {
    super(`Redis did not answer within ${COMMAND_TIMEOUT_MS} ms`);
  }
}

function describeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return describeError(error.errors[0]);
  }
  return error instanceof Error ? error.message || error.name : String(error);
}

/**
 * The connection to Redis, which holds short-lived state that should survive
 * a restart of the app: caches, rate limits and counters. Without a
 * configured URL it stays off for good. Connecting happens in the background
 * and never holds the app up: while Redis cannot be reached `isReady` is
 * false and every command rejects at once, so a caller falls back to memory.
 * A command Redis does not answer within a second rejects too and counts as
 * losing Redis: it is left alone for a few seconds, in which a connection
 * that stays silent is dropped and made anew.
 * Losing Redis and getting it back are each logged once, a failure while
 * connected at most once a minute. Singleton.
 */
export class RedisService {
  private client: RedisClient | null = null;
  private state: "idle" | "up" | "down" = "idle";
  private failureLoggedAt = 0;
  private pausedUntil = 0;

  constructor(private readonly url: string | null) {}

  /** Whether a Redis URL is configured. */
  get enabled(): boolean {
    return this.url !== null;
  }

  /** Whether a command sent now would reach Redis. */
  get isReady(): boolean {
    return (this.client?.isReady ?? false) && Date.now() >= this.pausedUntil;
  }

  /** Starts connecting in the background and keeps reconnecting from then on. Returns at once, connected or not. */
  initialize(): void {
    if (!this.url || this.client) return;

    const client = createClient({
      url: this.url,
      disableOfflineQueue: true,
      pingInterval: PING_INTERVAL_MS,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        socketTimeout: SILENT_CONNECTION_TIMEOUT_MS,
        reconnectStrategy: (retries) =>
          Math.min((retries + 1) * RECONNECT_STEP_MS, MAX_RECONNECT_DELAY_MS),
      },
    });
    client.on("ready", () => {
      this.pausedUntil = 0;
      this.markUp();
    });
    client.on("error", (error) => this.onClientError(error));

    this.client = client;
    client.connect().catch((error) => this.onClientError(error));
  }

  /** Sends one command and answers its raw reply. Rejects at once while Redis cannot be reached, and after a second when Redis does not answer. */
  async sendCommand(args: string[]): Promise<unknown> {
    if (!this.client || !this.isReady) {
      throw new Error("Redis is not connected");
    }

    try {
      const reply = await this.withinTimeLimit(this.client.sendCommand(args));
      if (this.state === "down" && this.isReady) this.markUp();
      return reply;
    } catch (error) {
      if (error instanceof RedisUnansweredError) {
        this.pausedUntil = Date.now() + UNANSWERED_PAUSE_MS;
        this.markDown(error);
      } else {
        this.noteFailure(
          `Redis command ${args[0] ?? "(none)"} failed, memory is used for it`,
          error,
        );
      }
      throw error;
    }
  }

  /** Closes the connection and stops reconnecting. */
  shutdown(): void {
    const client = this.client;
    this.client = null;
    this.state = "idle";
    if (client?.isOpen) client.destroy();
  }

  private withinTimeLimit<T>(reply: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new RedisUnansweredError()),
        COMMAND_TIMEOUT_MS,
      );
      reply.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private onClientError(error: unknown): void {
    if (this.client?.isReady) {
      this.noteFailure("Redis reported an error while connected", error);
      return;
    }
    this.markDown(error);
  }

  private markUp(): void {
    if (this.state === "up") return;
    logger.info(
      this.state === "down"
        ? "Redis can be reached again, caches and rate limits use it again"
        : "Redis connected",
    );
    this.state = "up";
  }

  private markDown(error: unknown): void {
    if (this.state === "down" || !this.client) return;
    this.state = "down";
    logger.warn(
      `Redis cannot be reached, caches and rate limits use memory until it is back: ${describeError(error)}`,
    );
  }

  private noteFailure(what: string, error: unknown): void {
    const now = Date.now();
    if (!this.isReady || now - this.failureLoggedAt < FAILURE_LOG_INTERVAL_MS) {
      return;
    }
    this.failureLoggedAt = now;
    logger.warn(`${what}: ${describeError(error)}`);
  }
}

export const redisService = new RedisService(config.redis.url);
