import { describe, it, expect, vi } from "vitest";

vi.mock("@/config", () => ({
  default: {
    servers: {
      rails: {
        id: 1,
        name: "Test Server",
        rcon: { host: "127.0.0.1", port: 25575, password: "test" },
      },
    },
  },
}));

import {
  MaintenanceModeClient,
  MaintenanceModeCommandError,
  parseAllowList,
  parseStatus,
} from "@/services/maintenance/mmode";
import { stripFormatting } from "@/utils/rcon";

function clientWith(responses: Record<string, string>) {
  const sent: string[] = [];
  const client = new MaintenanceModeClient(async (_serverId, command) => {
    sent.push(command);
    const key = Object.keys(responses).find((prefix) =>
      command.startsWith(prefix),
    );
    if (!key) throw new Error(`Unexpected command: ${command}`);
    return responses[key];
  });
  return { client, sent };
}

describe("mmode parsers", () => {
  it("strips legacy formatting codes", () => {
    expect(stripFormatting("Maintenance Mode: §eEnabled§r ")).toBe(
      "Maintenance Mode: Enabled",
    );
  });

  it("parses the status reply", () => {
    expect(parseStatus("Maintenance Mode: Enabled")).toBe(true);
    expect(parseStatus("Maintenance Mode: Disabled")).toBe(false);
    expect(parseStatus("Maintenance Mode: Failed to load config")).toBeNull();
    expect(parseStatus("")).toBeNull();
  });

  it("parses an empty allow list", () => {
    expect(parseAllowList("No users and groups are allowed to join")).toEqual({
      players: [],
      groups: [],
      ignored: [],
    });
  });

  it("parses players and luckperms groups separated by the mod's newline", () => {
    const reply =
      "There are 2 allowed player(s): Alice, bob_99\n" +
      "There are 1 allowed luckperms groups(s): staff";
    expect(parseAllowList(reply)).toEqual({
      players: ["Alice", "bob_99"],
      groups: ["staff"],
      ignored: [],
    });
  });

  it("stops the player list at the next message even without a separator", () => {
    const reply =
      "There are 2 allowed player(s): Alice, bob_99" +
      "There are 1 allowed luckperms groups(s): staff";
    expect(parseAllowList(reply)).toEqual({
      players: ["Alice", "bob_99"],
      groups: ["staff"],
      ignored: [],
    });
  });

  it("never returns tokens that are not Minecraft usernames", () => {
    const reply =
      "There are 3 allowed player(s): Alice, bob 99 weird, Some other message";
    expect(parseAllowList(reply)).toEqual({
      players: ["Alice"],
      groups: [],
      ignored: ["bob 99 weird", "Some other message"],
    });
  });
});

describe("MaintenanceModeClient", () => {
  it("reads the status through /maintenance status", async () => {
    const { client, sent } = clientWith({
      "maintenance status": "Maintenance Mode: §eEnabled",
    });
    await expect(client.status(1)).resolves.toBe(true);
    expect(sent).toEqual(["maintenance status"]);
  });

  it("uses schedule untilRestart when asked", async () => {
    const { client, sent } = clientWith({
      "maintenance schedule untilRestart":
        "Maintenance Mode: EnabledMaintenance is enabled until restart",
      "maintenance on": "Maintenance Mode: Enabled",
    });
    await client.enable(1, { untilRestart: true });
    await client.enable(1);
    expect(sent).toEqual([
      "maintenance schedule untilRestart",
      "maintenance on",
    ]);
  });

  it("rejects when the mod is not installed", async () => {
    const { client } = clientWith({
      "maintenance status":
        "Unknown or incomplete command, see below for error",
    });
    await expect(client.status(1)).rejects.toBeInstanceOf(
      MaintenanceModeCommandError,
    );
  });

  it("rejects when disable is not confirmed", async () => {
    const { client } = clientWith({
      "maintenance off": "Failed to save config. Please see server log",
    });
    await expect(client.disable(1)).rejects.toThrow(/Failed to disable/);
  });

  it("treats already-allowed and not-found replies as success", async () => {
    const { client } = clientWith({
      "maintenance addAllowed Alice":
        "User already in allowed listUser added to allowed listUpdated config",
      "maintenance removeAllowed Bob": "User not found in allowed list",
    });
    await expect(client.addAllowed(1, "Alice")).resolves.toBeUndefined();
    await expect(client.removeAllowed(1, "Bob")).resolves.toBeUndefined();
  });

  it("surfaces unknown players from addAllowed", async () => {
    const { client } = clientWith({
      "maintenance addAllowed Ghost": "That player does not exist",
    });
    await expect(client.addAllowed(1, "Ghost")).rejects.toThrow(
      /Failed to allow Ghost: That player does not exist/,
    );
  });

  it("refuses to send names that are not Minecraft usernames", async () => {
    const { client, sent } = clientWith({});
    await expect(
      client.addAllowed(1, "bob 99There are 1 allowed"),
    ).rejects.toThrow(/Invalid Minecraft username/);
    await expect(client.removeAllowed(1, "a\nb")).rejects.toThrow(
      /Invalid Minecraft username/,
    );
    expect(sent).toEqual([]);
  });

  it("translates & codes to § and keeps newlines for the MOTD and message", async () => {
    const { client, sent } = clientWith({
      "maintenance setMotd": "Updated config",
      "maintenance setMessage": "Updated config",
    });
    await client.setMotd(1, " &6&lDown &8| &cnow\r\n&7back  soon ");
    await client.setMessage(1, "Cogs & Steam\nline &Ktwo&r");
    expect(sent).toEqual([
      "maintenance setMotd §6§lDown §8| §cnow\n§7back  soon",
      "maintenance setMessage Cogs & Steam\nline §Ktwo§r",
    ]);
  });

  it("lists allowed players", async () => {
    const { client } = clientWith({
      "maintenance list": "There are 1 allowed player(s): Alice",
      "maintenance doBackups false":
        "Maintenance Mode Backups: DisabledUpdated config",
    });
    await expect(client.list(1)).resolves.toEqual({
      players: ["Alice"],
      groups: [],
      ignored: [],
    });
    await expect(client.setBackups(1, false)).resolves.toBeUndefined();
  });
});
