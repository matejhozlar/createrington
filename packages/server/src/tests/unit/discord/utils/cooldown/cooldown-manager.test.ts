import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CooldownManager } from "@/discord/utils/cooldown/cooldown-manager";

const userA = "user-A";
const userB = "user-B";

describe("CooldownManager", () => {
  let manager: CooldownManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new CooldownManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("check", () => {
    it("returns null for an unset cooldown", () => {
      expect(manager.check("ping", userA)).toBeNull();
    });

    it("returns remaining seconds when active", () => {
      manager.set("ping", userA, 10);
      expect(manager.check("ping", userA)).toBe(10);
    });

    it("counts down as time passes", () => {
      manager.set("ping", userA, 10);
      vi.advanceTimersByTime(3000);
      expect(manager.check("ping", userA)).toBe(7);
    });

    it("returns null after the cooldown expires", () => {
      manager.set("ping", userA, 10);
      vi.advanceTimersByTime(10_000);
      expect(manager.check("ping", userA)).toBeNull();
    });

    it("isolates cooldowns per user", () => {
      manager.set("ping", userA, 10);
      expect(manager.check("ping", userB)).toBeNull();
    });
  });

  describe("getExpiry", () => {
    it("returns null when no cooldown is set", () => {
      expect(manager.getExpiry("ping", userA)).toBeNull();
    });

    it("returns the absolute expiry timestamp in ms", () => {
      const now = Date.now();
      manager.set("ping", userA, 10);
      expect(manager.getExpiry("ping", userA)).toBe(now + 10_000);
    });

    it("returns null after expiry", () => {
      manager.set("ping", userA, 10);
      vi.advanceTimersByTime(10_000);
      expect(manager.getExpiry("ping", userA)).toBeNull();
    });
  });

  describe("resetCommand", () => {
    it("clears every cooldown for the named command", () => {
      manager.set("ping", userA, 60);
      manager.set("ping", userB, 60);
      expect(manager.resetCommand("ping")).toBe(true);
      expect(manager.check("ping", userA)).toBeNull();
      expect(manager.check("ping", userB)).toBeNull();
    });

    it("returns false when the command had no cooldowns", () => {
      expect(manager.resetCommand("never-used")).toBe(false);
    });
  });

  describe("resetUser", () => {
    it("clears every per-user cooldown across commands and returns the count", () => {
      manager.set("ping", userA, 60);
      manager.set("daily", userA, 60);
      manager.set("ping", userB, 60);

      const count = manager.resetUser("user-A");

      expect(count).toBe(2);
      expect(manager.check("ping", userA)).toBeNull();
      expect(manager.check("daily", userA)).toBeNull();
      expect(manager.check("ping", userB)).not.toBeNull();
    });

    it("returns 0 when the user has no cooldowns", () => {
      expect(manager.resetUser("nobody")).toBe(0);
    });
  });

  describe("getStats", () => {
    it("reports zero state on a fresh manager", () => {
      const stats = manager.getStats();
      expect(stats.totalCooldowns).toBe(0);
      expect(stats.totalCommands).toBe(0);
      expect(stats.byCommand).toEqual({});
    });

    it("aggregates across commands and entries", () => {
      manager.set("ping", userA, 60);
      manager.set("ping", userB, 60);
      manager.set("daily", userA, 60);

      const stats = manager.getStats();
      expect(stats.totalCooldowns).toBe(3);
      expect(stats.totalCommands).toBe(2);
      expect(stats.byCommand).toEqual({ ping: 2, daily: 1 });
    });
  });

  describe("automatic expiry via setTimeout", () => {
    it("removes the entry once the timer fires", () => {
      manager.set("ping", userA, 5);
      expect(manager.getStats().totalCooldowns).toBe(1);

      vi.advanceTimersByTime(5000);

      expect(manager.getStats().totalCooldowns).toBe(0);
      expect(manager.getStats().totalCommands).toBe(0);
    });

    it("keeps a newer cooldown when an earlier timer for the same key fires", () => {
      manager.set("ping", userA, 10);
      vi.advanceTimersByTime(4000);
      manager.set("ping", userA, 10);

      vi.advanceTimersByTime(6000);

      expect(manager.check("ping", userA)).toBe(4);
    });

    it("keeps other users' cooldowns when a timer from before resetCommand fires", () => {
      manager.set("ping", userA, 10);
      manager.resetCommand("ping");
      vi.advanceTimersByTime(4000);
      manager.set("ping", userB, 10);

      vi.advanceTimersByTime(6000);

      expect(manager.check("ping", userB)).toBe(4);
    });

    it("keeps other users' cooldowns when a timer from before resetUser fires", () => {
      manager.set("ping", userA, 10);
      manager.resetUser("user-A");
      vi.advanceTimersByTime(4000);
      manager.set("ping", userB, 10);

      vi.advanceTimersByTime(6000);

      expect(manager.check("ping", userB)).toBe(4);
    });
  });
});
