import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MinecraftRconManager,
  WhitelistAction,
  type ServerId,
} from "@/utils/rcon";

describe("MinecraftRconManager", () => {
  let rconManager: MinecraftRconManager;

  beforeEach(() => {
    vi.resetModules();
    rconManager = MinecraftRconManager.getInstance();
  });

  describe("Configuration", () => {
    it("should load server configuration on initialization", () => {
      const serverIds = rconManager.getServerIds();
      expect(serverIds).toContain(1);
      expect(serverIds).toContain(2);
    });

    it("should throw ServerNotFoundError for unknown server", async () => {
      await expect(rconManager.send(0 as ServerId, "list")).rejects.toThrow(
        "Server with ID 0 not found in configuration",
      );
    });
  });

  describe("Command validation", () => {
    it("should reject empty commands", async () => {
      await expect(rconManager.send(1, "")).rejects.toThrow(
        "Command cannot be empty",
      );
    });

    it("should reject whitelist without player name", async () => {
      await expect(
        rconManager.whitelist(1, WhitelistAction.ADD),
      ).rejects.toThrow("Player name is required");
    });

    it("should validate give command parameters", async () => {
      await expect(rconManager.give(1, "", "diamond", 1)).rejects.toThrow(
        "Player cannot be empty",
      );

      await expect(rconManager.give(1, "player", "", 1)).rejects.toThrow(
        "Item cannot be empty",
      );

      await expect(rconManager.give(1, "player", "diamond", 0)).rejects.toThrow(
        "Amount must be at least 1",
      );
    });
  });

  describe("Statistics", () => {
    it("should return correct stats structure", () => {
      const stats = rconManager.getStats();

      expect(stats).toHaveProperty("totalConfigured");
      expect(stats).toHaveProperty("activeConnections");
      expect(stats).toHaveProperty("servers");
      expect(Array.isArray(stats.servers)).toBe(true);
    });
  });
});
