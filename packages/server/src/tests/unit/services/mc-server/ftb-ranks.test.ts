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
  FtbRanksClient,
  FtbRanksCommandError,
} from "@/services/mc-server/ftb-ranks";

function clientWith(responses: Record<string, string>) {
  const sent: string[] = [];
  const client = new FtbRanksClient(async (_serverId, command) => {
    sent.push(command);
    const key = Object.keys(responses).find((prefix) =>
      command.startsWith(prefix),
    );
    if (!key) throw new Error(`Unexpected command: ${command}`);
    return responses[key];
  });
  return { client, sent };
}

describe("FtbRanksClient", () => {
  it("grants a rank with the player before the rank id", async () => {
    const { client, sent } = clientWith({
      "ftbranks add": "Player Steve added to rank 'Capitalist'!",
    });
    await expect(client.add(1, "Steve", "capitalist")).resolves.toBe(true);
    expect(sent).toEqual(["ftbranks add Steve capitalist"]);
  });

  it("treats a silent reply to add as already held", async () => {
    const { client } = clientWith({ "ftbranks add": "" });
    await expect(client.add(1, "Steve", "capitalist")).resolves.toBe(false);
  });

  it("revokes a rank and reports the change", async () => {
    const { client, sent } = clientWith({
      "ftbranks remove": "Player Steve removed from rank 'The Sleepless'!",
    });
    await expect(client.remove(1, "Steve", "the_sleepless")).resolves.toBe(
      true,
    );
    expect(sent).toEqual(["ftbranks remove Steve the_sleepless"]);
  });

  it("treats a silent reply to remove as not held", async () => {
    const { client } = clientWith({ "ftbranks remove": "   " });
    await expect(client.remove(1, "Steve", "the_sleepless")).resolves.toBe(
      false,
    );
  });

  it("strips legacy and hex formatting codes before matching", async () => {
    const { client } = clientWith({
      "ftbranks add":
        "§x§f§f§5§5§0§0Player Steve §eadded to rank 'Capitalist'!§r",
    });
    await expect(client.add(1, "Steve", "capitalist")).resolves.toBe(true);
  });

  it("rejects a rank that is not declared on the server", async () => {
    const { client } = clientWith({ "ftbranks add": "Unknown rank: nope" });
    const failure = client.add(1, "Steve", "nope");
    await expect(failure).rejects.toBeInstanceOf(FtbRanksCommandError);
    await expect(failure).rejects.toMatchObject({ reason: "unknown_rank" });
  });

  it("rejects a player the server cannot resolve", async () => {
    const { client } = clientWith({
      "ftbranks add": "That player does not exist",
    });
    await expect(client.add(1, "Nobody", "capitalist")).rejects.toMatchObject({
      reason: "unknown_player",
      message: /unknown to the server/,
    });
  });

  it("fails when the mod is not installed", async () => {
    const { client } = clientWith({
      "ftbranks remove": "Unknown or incomplete command, see below for error",
    });
    await expect(client.remove(1, "Steve", "capitalist")).rejects.toMatchObject(
      {
        reason: "unknown_command",
        message: /did not recognise/,
      },
    );
  });

  it("fails on an unexpected reply", async () => {
    const { client } = clientWith({ "ftbranks add": "§cSomething odd" });
    await expect(client.add(1, "Steve", "capitalist")).rejects.toMatchObject({
      name: "FtbRanksCommandError",
      reason: "unexpected_reply",
      command: "ftbranks add Steve capitalist",
      response: "Something odd",
    });
  });

  it("validates the username before sending anything", async () => {
    const { client, sent } = clientWith({ "ftbranks add": "" });
    await expect(client.add(1, "not a name", "capitalist")).rejects.toThrow(
      /Invalid Minecraft username/,
    );
    expect(sent).toEqual([]);
  });

  it("validates the rank id before sending anything", async () => {
    const { client, sent } = clientWith({ "ftbranks add": "" });
    await expect(client.add(1, "Steve", "the sleepless")).rejects.toThrow(
      /Invalid FTB Ranks rank id/,
    );
    expect(sent).toEqual([]);
  });
});
