import EventEmitter from "node:events";
import { type QueuedRequest, RequestPriority } from "./types";

/**
 * Manages request queues with priority-based ordering
 */
export class QueueManager extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type-erased container for heterogeneous requests
  private queues = new Map<string, QueuedRequest<any>[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private globalQueue: QueuedRequest<any>[] = [];
  private requestIdCounter = 0;

  /**
   * Add request to the queue
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

  /**
   * Get next request for a route
   */
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

  /**
   * Peek at the next request without removing it
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  peek(route: string): QueuedRequest<any> | null {
    const queue = this.queues.get(route);
    if (!queue || queue.length === 0) {
      return null;
    }
    return queue[0];
  }

  /**
   * Get queue size for a route
   */
  getQueueSize(route: string): number {
    const queue = this.queues.get(route);
    return queue ? queue.length : 0;
  }

  /**
   * Get total queue size across all routes
   */
  getTotalQueueSize(): number {
    let total = 0;
    this.queues.forEach((queue) => {
      total += queue.length;
    });
    return total;
  }

  /**
   * Get all queued routes
   */
  getQueuedRoutes(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Clear queue for a route
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
   * Clear all queues
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

  /**
   * Get request by priority
   */
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

  /**
   * Get queue statistics
   */
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
