import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CooldownManager,
  CooldownType,
  type CooldownContext,
} from "@/discord/utils/cooldown/cooldown-manager";

const ctxA: CooldownContext = {
  userId: "user-A",
  channelId: "channel-1",
  guildId: "guild-1",
};

const ctxB: CooldownContext = {
  userId: "user-B",
  channelId: "channel-2",
  guildId: "guild-1",
};

const ctxNoGuild: CooldownContext = {
  userId: "user-A",
  channelId: "channel-1",
  guildId: null,
};

describe("CooldownManager", () => {
  let manager: CooldownManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new CooldownManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("USER scope", () => {
    const cfg = { duration: 10, type: CooldownType.USER };

    it("returns null for an unset cooldown", () => {
      expect(manager.check("ping", cfg, ctxA)).toBeNull();
    });

    it("returns remaining seconds when active", () => {
      manager.set("ping", cfg, ctxA);
      expect(manager.check("ping", cfg, ctxA)).toBe(10);
    });

    it("counts down as time passes", () => {
      manager.set("ping", cfg, ctxA);
      vi.advanceTimersByTime(3000);
      expect(manager.check("ping", cfg, ctxA)).toBe(7);
    });

    it("returns null after the cooldown expires", () => {
      manager.set("ping", cfg, ctxA);
      vi.advanceTimersByTime(10_000);
      expect(manager.check("ping", cfg, ctxA)).toBeNull();
    });

    it("isolates cooldowns per user", () => {
      manager.set("ping", cfg, ctxA);
      expect(manager.check("ping", cfg, ctxB)).toBeNull();
    });
  });

  describe("GLOBAL scope", () => {
    const cfg = { duration: 5, type: CooldownType.GLOBAL };

    it("blocks every user once set", () => {
      manager.set("announce", cfg, ctxA);
      expect(manager.check("announce", cfg, ctxA)).toBe(5);
      expect(manager.check("announce", cfg, ctxB)).toBe(5);
    });
  });

  describe("CHANNEL scope", () => {
    const cfg = { duration: 5, type: CooldownType.CHANNEL };

    it("isolates cooldowns per channel", () => {
      manager.set("spam", cfg, ctxA); // channel-1
      expect(manager.check("spam", cfg, ctxA)).toBe(5);
      expect(manager.check("spam", cfg, ctxB)).toBeNull(); // channel-2
    });

    it("shares the cooldown across users in the same channel", () => {
      manager.set("spam", cfg, ctxA);
      const otherUserSameChannel: CooldownContext = {
        ...ctxA,
        userId: "user-other",
      };
      expect(manager.check("spam", cfg, otherUserSameChannel)).toBe(5);
    });
  });

  describe("GUILD scope", () => {
    const cfg = { duration: 5, type: CooldownType.GUILD };

    it("isolates per guild and shares across users in the same guild", () => {
      manager.set("daily", cfg, ctxA); // guild-1
      expect(manager.check("daily", cfg, ctxB)).toBe(5); // guild-1, different user
    });

    it("falls back to per-user keying when guildId is null", () => {
      manager.set("daily", cfg, ctxNoGuild);
      // Same user no guild → still on cooldown
      expect(manager.check("daily", cfg, ctxNoGuild)).toBe(5);
      // Different user no guild → independent
      const otherNoGuild: CooldownContext = { ...ctxNoGuild, userId: "other" };
      expect(manager.check("daily", cfg, otherNoGuild)).toBeNull();
    });
  });

  describe("getExpiry", () => {
    const cfg = { duration: 10, type: CooldownType.USER };

    it("returns null when no cooldown is set", () => {
      expect(manager.getExpiry("ping", CooldownType.USER, ctxA)).toBeNull();
    });

    it("returns the absolute expiry timestamp in ms", () => {
      const now = Date.now();
      manager.set("ping", cfg, ctxA);
      expect(manager.getExpiry("ping", CooldownType.USER, ctxA)).toBe(
        now + 10_000,
      );
    });

    it("returns null after expiry", () => {
      manager.set("ping", cfg, ctxA);
      vi.advanceTimersByTime(10_000);
      expect(manager.getExpiry("ping", CooldownType.USER, ctxA)).toBeNull();
    });
  });

  describe("reset", () => {
    const cfg = { duration: 60, type: CooldownType.USER };

    it("returns true and clears the cooldown when one exists", () => {
      manager.set("ping", cfg, ctxA);
      expect(manager.reset("ping", CooldownType.USER, ctxA)).toBe(true);
      expect(manager.check("ping", cfg, ctxA)).toBeNull();
    });

    it("returns false when no cooldown exists", () => {
      expect(manager.reset("ping", CooldownType.USER, ctxA)).toBe(false);
    });
  });

  describe("resetCommand", () => {
    const cfg = { duration: 60, type: CooldownType.USER };

    it("clears every cooldown for the named command", () => {
      manager.set("ping", cfg, ctxA);
      manager.set("ping", cfg, ctxB);
      expect(manager.resetCommand("ping")).toBe(true);
      expect(manager.check("ping", cfg, ctxA)).toBeNull();
      expect(manager.check("ping", cfg, ctxB)).toBeNull();
    });

    it("returns false when the command had no cooldowns", () => {
      expect(manager.resetCommand("never-used")).toBe(false);
    });
  });

  describe("resetUser", () => {
    it("clears every per-user cooldown across commands and returns the count", () => {
      const userCfg = { duration: 60, type: CooldownType.USER };
      manager.set("ping", userCfg, ctxA);
      manager.set("daily", userCfg, ctxA);
      manager.set("ping", userCfg, ctxB); // different user, should remain

      const count = manager.resetUser("user-A");

      expect(count).toBe(2);
      expect(manager.check("ping", userCfg, ctxA)).toBeNull();
      expect(manager.check("daily", userCfg, ctxA)).toBeNull();
      expect(manager.check("ping", userCfg, ctxB)).not.toBeNull();
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
      const cfg = { duration: 60, type: CooldownType.USER };
      manager.set("ping", cfg, ctxA);
      manager.set("ping", cfg, ctxB);
      manager.set("daily", cfg, ctxA);

      const stats = manager.getStats();
      expect(stats.totalCooldowns).toBe(3);
      expect(stats.totalCommands).toBe(2);
      expect(stats.byCommand).toEqual({ ping: 2, daily: 1 });
    });
  });

  describe("automatic expiry via setTimeout", () => {
    it("removes the entry once the timer fires", () => {
      const cfg = { duration: 5, type: CooldownType.USER };
      manager.set("ping", cfg, ctxA);
      expect(manager.getStats().totalCooldowns).toBe(1);

      vi.advanceTimersByTime(5000);

      expect(manager.getStats().totalCooldowns).toBe(0);
      expect(manager.getStats().totalCommands).toBe(0);
    });
  });
});
