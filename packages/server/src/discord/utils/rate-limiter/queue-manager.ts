import EventEmitter from "node:events";
import { type QueuedRequest, RequestPriority } from "./types";

/**
 * Priority-ordered request queue for the Discord rate limiter
 *
 * - Maintains per-route queues sorted by descending priority
 * - Emits "enqueue"/"dequeue" events for observability
 * - Provides stats and bulk-clear operations
 */
export class QueueManager extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type-erased container for heterogeneous requests
  private queues = new Map<string, QueuedRequest<any>[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private globalQueue: QueuedRequest<any>[] = [];
  private requestIdCounter = 0;

  /**
   * Adds a request to the route's queue, sorted by priority (highest first)
   *
   * @returns The generated request ID
   */
  enqueue<T>(request: Omit<QueuedRequest<T>, "id" | "queuedAt">): string {
    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

    const queuedRequest: QueuedRequest<T> = {
      ...request,
      id: requestId,
      queuedAt: Date.now(),
    };

    if (!this.queues.has(request.route)) {
      this.queues.set(request.route, []);
    }

    const queue = this.queues.get(request.route)!;
    queue.push(queuedRequest);

    queue.sort((a, b) => b.priority - a.priority);

    this.emit("enqueue", queuedRequest);

    logger.debug(`Enqueued request ${requestId} for route ${request.route}`, {
      priority: request.priority,
      queueSize: queue.length,
    });

    return requestId;
  }

  /** Removes and returns the highest-priority request for a route, or null if empty */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dequeue(route: string): QueuedRequest<any> | null {
    const queue = this.queues.get(route);
    if (!queue || queue.length === 0) {
      return null;
    }

    const request = queue.shift()!;

    if (queue.length === 0) {
      this.queues.delete(route);
    }

    this.emit("dequeue", request);

    return request;
  }

  /** Returns the next request for a route without removing it */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  peek(route: string): QueuedRequest<any> | null {
    const queue = this.queues.get(route);
    if (!queue || queue.length === 0) {
      return null;
    }
    return queue[0];
  }

  /** Returns the number of pending requests for a specific route */
  getQueueSize(route: string): number {
    const queue = this.queues.get(route);
    return queue ? queue.length : 0;
  }

  /** Returns the total number of pending requests across all routes */
  getTotalQueueSize(): number {
    let total = 0;
    this.queues.forEach((queue) => {
      total += queue.length;
    });
    return total;
  }

  /** Returns the list of routes that currently have queued requests */
  getQueuedRoutes(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Drops all queued requests for a route
   *
   * @returns The number of discarded requests
   */
  clearRoute(route: string): number {
    const queue = this.queues.get(route);
    if (!queue) return 0;

    const size = queue.length;
    this.queues.delete(route);

    logger.info(`Cleared ${size} requests from route ${route}`);
    return size;
  }

  /**
   * Drops all queued requests across every route
   *
   * @returns The total number of discarded requests
   */
  clearAll(): number {
    let total = 0;
    this.queues.forEach((queue) => {
      total += queue.length;
    });

    this.queues.clear();

    logger.info(`Cleared ${total} total requests from all queues`);
    return total;
  }

  /** Returns the count of queued requests broken down by priority level */
  getRequestsByPriority(): Record<RequestPriority, number> {
    const counts: Record<RequestPriority, number> = {
      [RequestPriority.CRITICAL]: 0,
      [RequestPriority.HIGH]: 0,
      [RequestPriority.NORMAL]: 0,
      [RequestPriority.LOW]: 0,
      [RequestPriority.BULK]: 0,
    };

    this.queues.forEach((queue) => {
      queue.forEach((request) => {
        counts[request.priority]++;
      });
    });

    return counts;
  }

  /** Returns aggregate queue statistics (totals, per-route counts, per-priority counts) */
  getStats() {
    const queuedByRoute: Record<string, number> = {};
    this.queues.forEach((queue, route) => {
      queuedByRoute[route] = queue.length;
    });

    return {
      totalQueued: this.getTotalQueueSize(),
      queuedByRoute,
      queuedByPriority: this.getRequestsByPriority(),
      activeRoutes: this.queues.size,
    };
  }
}
