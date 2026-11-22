import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/config", () => ({
  default: {
    servers: {
      rails: {
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

import { MinecraftRconManager, WhitelistAction } from "@/utils/rcon";

describe("MinecraftRconManager", () => {
  let rconManager: MinecraftRconManager;

  beforeEach(() => {
    rconManager = new MinecraftRconManager();
  });

  afterEach(async () => {
    await rconManager.shutdown();
  });

  describe("Configuration", () => {
    it("loads the configured server on initialization", () => {
      expect(rconManager.getServerIds()).toEqual([1]);
    });

    it("throws ServerNotFoundError for an unknown server", async () => {
      await expect(rconManager.send(0, "list")).rejects.toThrow(
        "Server with ID 0 not found in configuration",
      );
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
      ).rejects.toThrow("Player name is required for whitelist add");
    });

    it.each([
      ["banAll", () => rconManager.banAll("  ")],
      ["pardonAll", () => rconManager.pardonAll("")],
      [
        "whitelistAll",
        () => rconManager.whitelistAll(WhitelistAction.REMOVE, " "),
      ],
    ])("%s rejects a blank player name", async (_name, call) => {
      await expect(call()).rejects.toThrow("Player name cannot be empty");
    });
  });
});
