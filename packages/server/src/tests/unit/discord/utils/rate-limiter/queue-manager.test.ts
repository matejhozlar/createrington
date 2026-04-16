import { describe, it, expect, beforeEach } from "vitest";
import { QueueManager } from "@/discord/utils/rate-limiter/queue-manager";
import {
  RequestPriority,
  type QueuedRequest,
} from "@/discord/utils/rate-limiter/types";

type EnqueueInput = Omit<QueuedRequest<unknown>, "id" | "queuedAt">;

const makeRequest = (overrides: Partial<EnqueueInput> = {}): EnqueueInput => ({
  route: "/messages",
  priority: RequestPriority.NORMAL,
  operation: async () => undefined,
  resolve: () => {},
  reject: () => {},
  retries: 0,
  maxRetries: 3,
  timeout: 30_000,
  metadata: {},
  ...overrides,
});

describe("QueueManager", () => {
  let manager: QueueManager;

  beforeEach(() => {
    manager = new QueueManager();
  });

  describe("enqueue", () => {
    it("returns a unique id and adds the request to the route queue", () => {
      const id1 = manager.enqueue(makeRequest());
      const id2 = manager.enqueue(makeRequest());
      expect(id1).not.toBe(id2);
      expect(manager.getQueueSize("/messages")).toBe(2);
    });

    it("isolates queues by route", () => {
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/b" }));
      expect(manager.getQueueSize("/a")).toBe(1);
      expect(manager.getQueueSize("/b")).toBe(1);
      expect(manager.getQueuedRoutes().sort()).toEqual(["/a", "/b"]);
    });

    it("emits an 'enqueue' event with the queued request", () => {
      const events: QueuedRequest<unknown>[] = [];
      manager.on("enqueue", (req) => events.push(req));
      manager.enqueue(makeRequest());
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ route: "/messages" });
    });
  });

  describe("priority ordering", () => {
    it("orders requests within a route by descending priority", () => {
      manager.enqueue(makeRequest({ priority: RequestPriority.LOW }));
      manager.enqueue(makeRequest({ priority: RequestPriority.CRITICAL }));
      manager.enqueue(makeRequest({ priority: RequestPriority.NORMAL }));

      expect(manager.peek("/messages")?.priority).toBe(
        RequestPriority.CRITICAL,
      );
      expect(manager.dequeue("/messages")?.priority).toBe(
        RequestPriority.CRITICAL,
      );
      expect(manager.dequeue("/messages")?.priority).toBe(
        RequestPriority.NORMAL,
      );
      expect(manager.dequeue("/messages")?.priority).toBe(RequestPriority.LOW);
    });
  });

  describe("dequeue", () => {
    it("returns null for empty/unknown routes", () => {
      expect(manager.dequeue("/unknown")).toBeNull();
    });

    it("removes the route entry once empty", () => {
      manager.enqueue(makeRequest());
      manager.dequeue("/messages");
      expect(manager.getQueuedRoutes()).toEqual([]);
    });

    it("emits a 'dequeue' event", () => {
      const events: QueuedRequest<unknown>[] = [];
      manager.on("dequeue", (req) => events.push(req));
      manager.enqueue(makeRequest());
      manager.dequeue("/messages");
      expect(events).toHaveLength(1);
    });
  });

  describe("peek", () => {
    it("returns the next request without removing it", () => {
      manager.enqueue(makeRequest());
      manager.peek("/messages");
      expect(manager.getQueueSize("/messages")).toBe(1);
    });

    it("returns null for empty/unknown routes", () => {
      expect(manager.peek("/nope")).toBeNull();
    });
  });

  describe("size + clear operations", () => {
    it("getTotalQueueSize sums across all routes", () => {
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/b" }));
      expect(manager.getTotalQueueSize()).toBe(3);
    });

    it("clearRoute drops every request for a route and returns the count", () => {
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/b" }));

      expect(manager.clearRoute("/a")).toBe(2);
      expect(manager.getQueueSize("/a")).toBe(0);
      expect(manager.getQueueSize("/b")).toBe(1);
    });

    it("clearRoute returns 0 for unknown routes", () => {
      expect(manager.clearRoute("/none")).toBe(0);
    });

    it("clearAll drops every queued request and returns the total", () => {
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(makeRequest({ route: "/b" }));
      expect(manager.clearAll()).toBe(2);
      expect(manager.getTotalQueueSize()).toBe(0);
      expect(manager.getQueuedRoutes()).toEqual([]);
    });
  });

  describe("getRequestsByPriority", () => {
    it("counts requests across every priority bucket", () => {
      manager.enqueue(makeRequest({ priority: RequestPriority.CRITICAL }));
      manager.enqueue(makeRequest({ priority: RequestPriority.HIGH }));
      manager.enqueue(makeRequest({ priority: RequestPriority.HIGH }));
      manager.enqueue(makeRequest({ priority: RequestPriority.BULK }));

      const counts = manager.getRequestsByPriority();
      expect(counts).toEqual({
        [RequestPriority.CRITICAL]: 1,
        [RequestPriority.HIGH]: 2,
        [RequestPriority.NORMAL]: 0,
        [RequestPriority.LOW]: 0,
        [RequestPriority.BULK]: 1,
      });
    });
  });

  describe("getStats", () => {
    it("reports zero state on a fresh manager", () => {
      expect(manager.getStats()).toMatchObject({
        totalQueued: 0,
        queuedByRoute: {},
        activeRoutes: 0,
      });
    });

    it("aggregates totals, per-route, and per-priority counts", () => {
      manager.enqueue(makeRequest({ route: "/a" }));
      manager.enqueue(
        makeRequest({ route: "/a", priority: RequestPriority.HIGH }),
      );
      manager.enqueue(
        makeRequest({ route: "/b", priority: RequestPriority.LOW }),
      );

      const stats = manager.getStats();
      expect(stats.totalQueued).toBe(3);
      expect(stats.queuedByRoute).toEqual({ "/a": 2, "/b": 1 });
      expect(stats.activeRoutes).toBe(2);
      expect(stats.queuedByPriority[RequestPriority.NORMAL]).toBe(1);
      expect(stats.queuedByPriority[RequestPriority.HIGH]).toBe(1);
      expect(stats.queuedByPriority[RequestPriority.LOW]).toBe(1);
    });
  });
});
