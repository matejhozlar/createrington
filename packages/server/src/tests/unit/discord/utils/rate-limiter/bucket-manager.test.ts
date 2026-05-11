import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BucketManager } from "@/discord/utils/rate-limiter/bucket-manager";

const headers = (overrides: Record<string, string> = {}) => ({
  "x-ratelimit-bucket": "bucket-1",
  "x-ratelimit-limit": "5",
  "x-ratelimit-remaining": "4",
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 10),
  "x-ratelimit-reset-after": "10",
  ...overrides,
});

describe("BucketManager", () => {
  let manager: BucketManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new BucketManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("updateFromHeaders", () => {
    it("ignores responses without a bucket header", () => {
      manager.updateFromHeaders("/foo", { "x-ratelimit-limit": "5" });
      expect(manager.getAllBuckets()).toEqual([]);
      expect(manager.getBucket("/foo")).toBeNull();
    });

    it("creates a bucket and links it to the route", () => {
      manager.updateFromHeaders("/foo", headers());
      const bucket = manager.getBucket("/foo");
      expect(bucket).toMatchObject({
        id: "bucket-1",
        limit: 5,
        remaining: 4,
        global: false,
      });
    });

    it("shares buckets across routes that report the same bucket id", () => {
      manager.updateFromHeaders(
        "/a",
        headers({ "x-ratelimit-remaining": "2" }),
      );
      manager.updateFromHeaders(
        "/b",
        headers({ "x-ratelimit-remaining": "1" }),
      );
      // Same bucket-1, second update wins
      expect(manager.getBucket("/a")?.remaining).toBe(1);
      expect(manager.getBucket("/b")?.remaining).toBe(1);
      expect(manager.getAllBuckets()).toHaveLength(1);
    });
  });

  describe("canRequest", () => {
    it("allows requests for unknown routes", () => {
      expect(manager.canRequest("/unknown")).toEqual({
        allowed: true,
        waitTime: 0,
      });
    });

    it("allows requests when remaining > 0", () => {
      manager.updateFromHeaders("/foo", headers());
      expect(manager.canRequest("/foo")).toEqual({
        allowed: true,
        waitTime: 0,
      });
    });

    it("blocks and returns waitTime when bucket is depleted and not yet reset", () => {
      manager.updateFromHeaders(
        "/foo",
        headers({ "x-ratelimit-remaining": "0" }),
      );
      const result = manager.canRequest("/foo");
      expect(result.allowed).toBe(false);
      expect(result.waitTime).toBeGreaterThan(0);
      expect(result.reason).toBe("bucket_bucket-1_depleted");
    });

    it("allows again once the reset timestamp has passed", () => {
      manager.updateFromHeaders(
        "/foo",
        headers({ "x-ratelimit-remaining": "0" }),
      );
      vi.advanceTimersByTime(11_000);
      expect(manager.canRequest("/foo")).toEqual({
        allowed: true,
        waitTime: 0,
      });
    });
  });

  describe("consumeRequest", () => {
    it("decrements the remaining counter", () => {
      manager.updateFromHeaders("/foo", headers());
      manager.consumeRequest("/foo");
      expect(manager.getBucket("/foo")?.remaining).toBe(3);
    });

    it("never goes below zero", () => {
      manager.updateFromHeaders(
        "/foo",
        headers({ "x-ratelimit-remaining": "0" }),
      );
      manager.consumeRequest("/foo");
      expect(manager.getBucket("/foo")?.remaining).toBe(0);
    });

    it("is a no-op for unknown routes", () => {
      expect(() => manager.consumeRequest("/unknown")).not.toThrow();
    });
  });

  describe("handle429", () => {
    it("zeroes the bucket and sets a new reset on per-route 429", () => {
      manager.updateFromHeaders("/foo", headers());
      manager.handle429("/foo", 5, false);

      const bucket = manager.getBucket("/foo");
      expect(bucket?.remaining).toBe(0);
      expect(bucket?.resetAfter).toBe(5);

      const result = manager.canRequest("/foo");
      expect(result.allowed).toBe(false);
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it("does not error for routes without a tracked bucket", () => {
      expect(() => manager.handle429("/unknown", 5, false)).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("removes buckets whose reset is more than 5 minutes in the past", () => {
      const stalePastSeconds = Math.floor(Date.now() / 1000) - 1000;
      manager.updateFromHeaders(
        "/old",
        headers({ "x-ratelimit-reset": String(stalePastSeconds) }),
      );

      manager.cleanup();

      expect(manager.getAllBuckets()).toEqual([]);
      expect(manager.getBucket("/old")).toBeNull();
    });

    it("keeps buckets whose reset is recent or in the future", () => {
      manager.updateFromHeaders("/fresh", headers());
      manager.cleanup();
      expect(manager.getAllBuckets()).toHaveLength(1);
    });
  });
});
