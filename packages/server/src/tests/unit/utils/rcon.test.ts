import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// Mock the config so this test doesn't depend on env vars or the real
// production singleton state. The real config requires COGS_AND_STEAM_*
// env vars that aren't set in CI.
vi.mock("@/config", () => ({
  default: {
    servers: {
      cogs: {
        id: 1,
        name: "Test Server",
        rcon: {
          host: "127.0.0.1",
          port: 25575,
          password: "test-password",
        },
      },
    },
  },
}));

import {
  MinecraftRconManager,
  WhitelistAction,
  type ServerId,
} from "@/utils/rcon";

describe("MinecraftRconManager", () => {
  let rconManager: MinecraftRconManager;

  beforeEach(async () => {
    // shutdown() resets the singleton so each test gets a fresh instance.
    await MinecraftRconManager.getInstance().shutdown();
    rconManager = MinecraftRconManager.getInstance();
  });

  afterAll(async () => {
    await MinecraftRconManager.getInstance().shutdown();
  });

  describe("Configuration", () => {
    it("loads the configured server on initialization", () => {
      expect(rconManager.getServerIds()).toEqual([1]);
    });

    it("exposes server info for a configured server", () => {
      const info = rconManager.getServerInfo(1);
      expect(info).toMatchObject({
        id: 1,
        name: "Test Server",
        rcon: { host: "127.0.0.1", port: 25575, password: "test-password" },
      });
    });

    it("reports configured servers via hasServer", () => {
      expect(rconManager.hasServer(1)).toBe(true);
      expect(rconManager.hasServer(99)).toBe(false);
    });

    it("throws ServerNotFoundError for an unknown server", async () => {
      await expect(rconManager.send(0 as ServerId, "list")).rejects.toThrow(
        "Server with ID 0 not found in configuration",
      );
    });
  });

  describe("Dynamic registration", () => {
    it("registers and unregisters a server at runtime", async () => {
      rconManager.registerServer(42, "Dynamic", {
        host: "10.0.0.1",
        port: 25580,
        password: "pw",
      });
      expect(rconManager.hasServer(42)).toBe(true);

      await rconManager.unregisterServer(42);
      expect(rconManager.hasServer(42)).toBe(false);
    });
  });

  describe("Command validation", () => {
    it("rejects empty commands before attempting to connect", async () => {
      await expect(rconManager.send(1, "")).rejects.toThrow(
        "Command cannot be empty",
      );
    });

    it("rejects whitelist add/remove without a player name", async () => {
      await expect(
        rconManager.whitelist(1, WhitelistAction.ADD),
      ).rejects.toThrow("Player name is required");
    });

    it("validates give command parameters", async () => {
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
    it("returns the correct stats structure", () => {
      const stats = rconManager.getStats();

      expect(stats.totalConfigured).toBe(1);
      expect(stats.activeConnections).toBe(0);
      expect(stats.servers).toEqual([
        expect.objectContaining({
          serverId: 1,
          serverName: "Test Server",
          connected: false,
        }),
      ]);
    });
  });
});
