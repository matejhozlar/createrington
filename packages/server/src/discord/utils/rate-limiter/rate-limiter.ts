import EventEmitter from "node:events";
import { BucketManager } from "./bucket-manager";
import { QueueManager } from "./queue-manager";
import type {
  QueuedRequest,
  RateLimitedRequestOptions,
  RateLimiterStats,
} from "./types";
import { RequestTimeoutError, RequestPriority } from "./types";
import { RateLimitError } from "discord.js";

interface DiscordHttpError {
  message?: string;
  status?: number;
  code?: number;
  httpStatus?: number;
  global?: boolean;
  retry_after?: number;
  retryAfter?: number;
  headers?: Record<string, string>;
}

/** Normalizes an unknown error into a DiscordHttpError shape for uniform handling */
function toDiscordError(error: unknown): DiscordHttpError {
  if (error instanceof RateLimitError) return error;
  if (typeof error === "object" && error !== null) return error as DiscordHttpError;
  return { message: String(error) };
}

/**
 * Discord API rate limiter
 *
 * - Bucket-aware rate limiting synced from response headers
 * - Priority queue with automatic retry on 429 responses
 * - Global and per-route rate limit tracking
 * - Background cleanup of stale buckets and high-queue alerts
 */
export class DiscordRateLimiter extends EventEmitter {
  private bucketManager = new BucketManager();
  private queueManager = new QueueManager();

  private processing = new Set<string>();
  private requestsInFlight = 0;

  private stats = {
    totalProcessed: 0,
    totalFailed: 0,
    rateLimitHits: 0,
    queueTimes: [] as number[],
  };

  private readonly MAX_REQUESTS_IN_FLIGHT = 10;
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly CLEANUP_INTERVAL = 300000;

  constructor() {
    super();
    this.startBackgroundTasks();
  }

  /**
   * Queue a Discord API request with automatic rate limiting
   *
   * @example
   * const result = await rateLimiter.execute({
   *    route: "channels/123/messages",
   *    priority: RequestPriority.HIGH,
   *    operation: async () => {
   *        return await channel.send("Hello!");
   *    }
   * })
   */
  async execute<T>(
    options: RateLimitedRequestOptions & {
      operation: () => Promise<T>;
    },
  ): Promise<T> {
    const {
      operation,
      route,
      priority = RequestPriority.NORMAL,
      maxRetries = this.DEFAULT_MAX_RETRIES,
      timeout = this.DEFAULT_TIMEOUT,
      metadata = {},
    } = options;

    return new Promise<T>((resolve, reject) => {
      this.queueManager.enqueue({
        route,
        priority,
        operation,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        timeout,
        metadata,
      });

      this.processQueue(route);
    });
  }

  /**
   * Drains the queue for a route one request at a time, respecting bucket limits
   * @private
   */
  private async processQueue(route: string): Promise<void> {
    if (this.processing.has(route)) {
      return;
    }

    if (this.requestsInFlight >= this.MAX_REQUESTS_IN_FLIGHT) {
      return;
    }

    const request = this.queueManager.peek(route);
    if (!request) return;

    const { allowed, waitTime, reason } = this.bucketManager.canRequest(route);

    if (!allowed) {
      logger.debug(
        `Route ${route} rate limited, waiting ${waitTime}ms (${reason})`,
      );

      setTimeout(() => this.processQueue(route), waitTime + 100);
      return;
    }

    this.processing.add(route);
    this.requestsInFlight++;

    this.queueManager.dequeue(route);

    try {
      await this.executeRequest(request);
    } finally {
      this.processing.delete(route);
      this.requestsInFlight--;

      if (this.queueManager.getQueueSize(route) > 0) {
        setImmediate(() => this.processQueue(route));
      }
    }
  }

  /**
   * Executes a single request with timeout enforcement and records metrics
   * @private
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new RequestTimeoutError(
              `Request timed out after ${request.timeout}ms`,
            ),
          );
        }, request.timeout);
      });

      const result = await Promise.race([request.operation(), timeoutPromise]);

      request.executedAt = Date.now();
      const queueTime = request.executedAt - request.queuedAt;

      this.stats.totalProcessed++;
      this.stats.queueTimes.push(queueTime);

      if (this.stats.queueTimes.length > 1000) {
        this.stats.queueTimes.shift();
      }

      this.bucketManager.consumeRequest(request.route);

      this.emit("request:success", {
        requestId: request.id,
        route: request.route,
        queueTime,
        executionTime: Date.now() - startTime,
      });

      request.resolve(result);

      logger.debug(`Request ${request.id} completed successfully`, {
        route: request.route,
        queueTime,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      await this.handleRequestError(request, error, startTime);
    }
  }

  /**
   * Handles errors by re-queuing on 429s (up to maxRetries) or rejecting permanently
   * @private
   */
  private async handleRequestError<T>(
    request: QueuedRequest<T>,
    rawError: unknown,
    startTime: number,
  ): Promise<void> {
    const error = toDiscordError(rawError);
    const executionTime = Date.now() - startTime;

    if (this.isRateLimitError(error)) {
      this.stats.rateLimitHits++;

      const retryAfter = this.extractRetryAfter(error);
      const global = this.isGlobalRateLimit(error);

      this.bucketManager.handle429(request.route, retryAfter, global);

      logger.warn(`Rate limit hit for request ${request.id}`, {
        route: request.route,
        retryAfter,
        global,
        retries: request.retries,
      });

      if (request.retries < request.maxRetries) {
        request.retries++;

        this.emit("request:retry", {
          requestId: request.id,
          route: request.route,
          retryAfter,
          attempt: request.retries,
        });

        this.queueManager.enqueue({
          ...request,
        });

        setTimeout(
          () => this.processQueue(request.route),
          retryAfter * 1000 + 100,
        );

        return;
      }
    }

    this.stats.totalFailed++;

    this.emit("request:failed", {
      requestId: request.id,
      route: request.route,
      error: error.message,
      executionTime,
      retries: request.retries,
    });

    logger.error(`Request ${request.id} failed permanently`, {
      route: request.route,
      error: error.message,
      retries: request.retries,
      executionTime,
    });

    request.reject(rawError instanceof Error ? rawError : new Error(error.message ?? "Request failed"));
  }

  /** @private Detects 429 status in various Discord error shapes */
  private isRateLimitError(error: DiscordHttpError): boolean {
    return (
      error?.status === 429 ||
      error?.code === 429 ||
      error?.httpStatus === 429 ||
      error instanceof RateLimitError
    );
  }

  /** @private Extracts the retry-after value (in seconds) from various error formats */
  private extractRetryAfter(error: DiscordHttpError): number {
    if (error instanceof RateLimitError) {
      return error.retryAfter;
    }

    return (
      error?.retry_after ||
      error?.retryAfter ||
      parseFloat(error?.headers?.["retry-after"] ?? "") ||
      1
    );
  }

  /** @private Determines whether a rate limit error applies globally */
  private isGlobalRateLimit(error: DiscordHttpError): boolean {
    if (error instanceof RateLimitError) {
      return error.global;
    }

    return (
      error?.global === true ||
      error?.headers?.["x-ratelimit-global"] === "true"
    );
  }

  /** Forwards response headers to the bucket manager to update rate limit state */
  updateBucketFromHeaders(
    route: string,
    headers: Record<string, string>,
  ): void {
    this.bucketManager.updateFromHeaders(route, headers);
  }

  /** Returns combined statistics from the queue manager, bucket manager, and internal counters */
  getStats(): RateLimiterStats {
    const queueStats = this.queueManager.getStats();

    const averageQueueTime =
      this.stats.queueTimes.length > 0
        ? this.stats.queueTimes.reduce((a, b) => a + b, 0) /
          this.stats.queueTimes.length
        : 0;

    return {
      totalQueued: queueStats.totalQueued,
      queuedByRoute: queueStats.queuedByRoute,
      queuedByPriority: queueStats.queuedByPriority,
      totalProcessed: this.stats.totalProcessed,
      totalFailed: this.stats.totalFailed,
      rateLimitHits: this.stats.rateLimitHits,
      averageQueueTime: Math.round(averageQueueTime),
      activeBuckets: this.bucketManager.getAllBuckets().length,
      globalRateLimitActive: this.bucketManager.isGlobalRateLimitActive(),
      requestsInFlight: this.requestsInFlight,
    };
  }

  /**
   * Starts periodic bucket cleanup (every 5 min) and high-queue-size warnings (every 1 min)
   * @private
   */
  private startBackgroundTasks(): void {
    setInterval(() => {
      this.bucketManager.cleanup();
    }, this.CLEANUP_INTERVAL);

    setInterval(() => {
      const stats = this.getStats();
      if (stats.totalQueued > 50) {
        logger.warn("High queue size detected:", stats);
      }
    }, 60000); // Every minute
  }

  /** Clears all queued requests, removes event listeners, and logs final stats */
  async shutdown(): Promise<void> {
    logger.info("Shutting down rate limiter...");

    const stats = this.getStats();
    if (stats.totalQueued > 0) {
      logger.warn(
        `Shutting down with ${stats.totalQueued} requests still queued`,
      );
    }

    this.queueManager.clearAll();
    this.removeAllListeners();

    logger.info("Rate limiter shutdown complete");
  }
}
