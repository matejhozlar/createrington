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
  PartyCommandError,
  PartyMembersClient,
} from "@/services/mc-server/party-members";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function clientWith(response: string) {
  const sent: string[] = [];
  const client = new PartyMembersClient(async (_serverId, command) => {
    sent.push(command);
    return response;
  });
  return { client, sent };
}

describe("PartyMembersClient", () => {
  it("removes a member by UUID and reads the names from the reply", async () => {
    const { client, sent } = clientWith(
      `Removed Steve (${UUID}) from Steve's Crew.`,
    );
    await expect(client.remove(1, UUID.toUpperCase())).resolves.toEqual({
      outcome: "removed",
      playerName: "Steve",
      partyName: "Steve's Crew",
    });
    expect(sent).toEqual([`createrington party remove ${UUID}`]);
  });

  it("reports an owner core refused to remove", async () => {
    const { client } = clientWith(
      `Steve (${UUID}) owns Steve's Crew and is never removed from it.`,
    );
    await expect(client.remove(1, UUID)).resolves.toEqual({
      outcome: "owner",
      playerName: "Steve",
      partyName: "Steve's Crew",
    });
  });

  it("reports a player who is in no party", async () => {
    const { client } = clientWith(`${UUID} (${UUID}) is not in a party.`);
    await expect(client.remove(1, UUID)).resolves.toEqual({
      outcome: "not_in_party",
      playerName: UUID,
    });
  });

  it("strips formatting codes before reading the reply", async () => {
    const { client } = clientWith(
      `§aRemoved Steve (${UUID}) from Steve's Crew.§r`,
    );
    await expect(client.remove(1, UUID)).resolves.toMatchObject({
      outcome: "removed",
    });
  });

  it("refuses an argument that is not a UUID", async () => {
    const { client, sent } = clientWith("");
    await expect(client.remove(1, "Steve; stop")).rejects.toThrow(
      "Invalid Minecraft UUID",
    );
    expect(sent).toEqual([]);
  });

  it("raises unknown_command when core lacks the command", async () => {
    const { client } = clientWith(
      "Unknown or incomplete command, see below for error",
    );
    await expect(client.remove(1, UUID)).rejects.toMatchObject({
      name: "PartyCommandError",
      reason: "unknown_command",
    });
  });

  it("raises not_reporting while party sync is off", async () => {
    const { client } = clientWith(
      "Party members are not managed: party_sync is off.",
    );
    await expect(client.remove(1, UUID)).rejects.toMatchObject({
      reason: "not_reporting",
    });
  });

  it("raises unexpected_reply when FTB Teams refuses the kick", async () => {
    const { client } = clientWith(
      `Could not remove ${UUID} from their party: Player is not in a party!`,
    );
    await expect(client.remove(1, UUID)).rejects.toMatchObject({
      reason: "unexpected_reply",
    });
  });

  it("raises unexpected_reply for an unknown answer", async () => {
    const { client } = clientWith("Something else happened");
    const error = await client.remove(1, UUID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PartyCommandError);
    expect(error).toMatchObject({ reason: "unexpected_reply" });
  });

  it("asks core for a party send", async () => {
    const { client, sent } = clientWith(
      "Sending the parties to the app at the next tick.",
    );
    await expect(client.sync(1)).resolves.toBeUndefined();
    expect(sent).toEqual(["createrington party sync"]);
  });

  it("raises not_reporting when core cannot send", async () => {
    const { client } = clientWith(
      "Parties are not being reported: party_sync is off or its jwtSecret is not set.",
    );
    await expect(client.sync(1)).rejects.toMatchObject({
      reason: "not_reporting",
    });
  });
});
