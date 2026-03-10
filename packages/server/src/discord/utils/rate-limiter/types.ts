/**
 * Discord rate limit bucket information
 * Extracted from Discord API response headers
 */
export interface RateLimitBucket {
  /** Unique bucket identifier */
  id: string;
  /** Maximum requests allowed in this bucket */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** When the current window resets (unix timestamp in seconds) */
  reset: number;
  /** Duration of the rate limit window in seconds */
  resetAfter: number;
  /** Global rate limit flag */
  global: boolean;
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  /** Critical operations (anti-spam, moderation) */
  CRITICAL = 100,
  /** High priority (user interactions, commands) */
  HIGH = 75,
  /** Normal priority (most operations) */
  NORMAL = 50,
  /** Low priority (background tasks) */
  LOW = 25,
  /** Bulk operations (leaderboards, stats update) */
  BULK = 0,
}

/**
 * Request options for rate limiter
 */
export interface RateLimitedRequestOptions {
  /** Request priority (higher executes first) */
  priority?: RequestPriority;
  /** Maximum retry attempts on rate limit */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Route identifier for bucket management */
  route: string;
  /** Optional request metadata for logging */
  metadata?: Record<string, unknown>;
}

/**
 * Queued request structure
 */
export interface QueuedRequest<T> {
  id: string;
  route: string;
  priority: RequestPriority;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
  timeout: number;
  metadata: Record<string, unknown>;
  queuedAt: number;
  executedAt?: number;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  /** Total requests queued currently */
  totalQueued: number;
  /** Requests queued by route */
  queuedByRoute: Record<string, number>;
  /** Requests queued by priority */
  queuedByPriority: Record<RequestPriority, number>;
  /** Total requests processed */
  totalProcessed: number;
  /** Total requests failed */
  totalFailed: number;
  /** Total rate limit hits */
  rateLimitHits: number;
  /** Average queue time in ms */
  averageQueueTime: number;
  /** Active buckets */
  activeBuckets: number;
  /** Global rate limit active */
  globalRateLimitActive: boolean;
  /** Request in flight */
  requestsInFlight: number;
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly global: boolean = false,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Request timeout error
 */
export class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}
