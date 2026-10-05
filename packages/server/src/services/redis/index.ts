import { createClient } from "@redis/client";
import config from "@/config";

const CONNECT_TIMEOUT_MS = 2000;
const COMMAND_TIMEOUT_MS = 1000;
const RECONNECT_STEP_MS = 200;
const MAX_RECONNECT_DELAY_MS = 5000;
const COMMAND_FAILURE_LOG_INTERVAL_MS = 60_000;

interface RedisClient {
  readonly isReady: boolean;
  readonly isOpen: boolean;
  sendCommand(args: string[]): Promise<unknown>;
  destroy(): void;
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
 * Losing Redis and getting it back are each logged once, a command that
 * fails while connected at most once a minute. Singleton.
 */
export class RedisService {
  private client: RedisClient | null = null;
  private state: "idle" | "up" | "down" = "idle";
  private commandFailureLoggedAt = 0;

  constructor(private readonly url: string | null) {}

  /** Whether a Redis URL is configured. */
  get enabled(): boolean {
    return this.url !== null;
  }

  /** Whether a command sent now would reach Redis. */
  get isReady(): boolean {
    return this.client?.isReady ?? false;
  }

  /** Starts connecting in the background and keeps reconnecting from then on. Returns at once, connected or not. */
  initialize(): void {
    if (!this.url || this.client) return;

    const client = createClient({
      url: this.url,
      disableOfflineQueue: true,
      commandOptions: { timeout: COMMAND_TIMEOUT_MS },
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) =>
          Math.min((retries + 1) * RECONNECT_STEP_MS, MAX_RECONNECT_DELAY_MS),
      },
    });
    client.on("ready", () => this.markUp());
    client.on("error", (error) => this.markDown(error));

    this.client = client;
    client.connect().catch((error) => this.markDown(error));
  }

  /** Sends one command and answers its raw reply. Rejects at once while Redis cannot be reached. */
  async sendCommand(args: string[]): Promise<unknown> {
    if (!this.client?.isReady) throw new Error("Redis is not connected");

    try {
      return await this.client.sendCommand(args);
    } catch (error) {
      this.noteCommandFailure(args[0], error);
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

  private noteCommandFailure(
    command: string | undefined,
    error: unknown,
  ): void {
    const now = Date.now();
    if (
      !this.isReady ||
      now - this.commandFailureLoggedAt < COMMAND_FAILURE_LOG_INTERVAL_MS
    ) {
      return;
    }
    this.commandFailureLoggedAt = now;
    logger.warn(
      `Redis command ${command ?? "(none)"} failed, memory is used for it: ${describeError(error)}`,
    );
  }
}

export const redisService = new RedisService(config.redis.url);
