import { describe, it, expect, vi } from "vitest";
import {
  ChannelType,
  Collection,
  OverwriteType,
  type Client,
} from "discord.js";

const ticketGet = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => ({
  close: vi.fn(),
  updateMetadata: vi.fn(),
}));
const sendMessage = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(async () => undefined) },
}));

vi.mock("@/config", () => ({
  default: {
    storage: { path: "storage" },
    discord: { guild: { id: "guild-1", categories: { tickets: "cat-1" } } },
  },
}));

vi.mock("@/db", () => ({ Q: { ticket: { get: ticketGet } } }));

vi.mock("@/db/repositories/ticket", () => ({
  TicketRepository: class {
    close = repository.close;
    updateMetadata = repository.updateMetadata;
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { TRANSCRIPTS: "transcripts-1" } },
    Roles: { ADMIN: "admin-role", OWNER: "owner-role" },
    Messages: { send: sendMessage },
  },
}));

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: { ticket: { close: () => ({ build: () => [] }) } },
}));

import { TicketService } from "@/services/discord/tickets/ticket.service";

interface FakeOverwrite {
  id: string;
  type: OverwriteType;
  delete: () => Promise<void>;
}

function fakeBot(options: {
  memberIds?: string[];
  roleIds?: string[];
  type?: ChannelType;
  failingIds?: string[];
}) {
  const cache = new Collection<string, FakeOverwrite>();
  const remove = async (id: string) => {
    if (options.failingIds?.includes(id)) {
      throw new Error("Missing Permissions");
    }
    cache.delete(id);
  };
  const add = (id: string, type: OverwriteType) =>
    cache.set(id, { id, type, delete: () => remove(id) });

  for (const id of options.roleIds ?? []) add(id, OverwriteType.Role);
  for (const id of options.memberIds ?? []) add(id, OverwriteType.Member);

  const permissionOverwrites = {
    cache,
    edit: vi.fn(async () => undefined),
    delete: vi.fn(remove),
  };
  const channel = {
    type: options.type ?? ChannelType.GuildText,
    send: async () => undefined,
    permissionOverwrites,
  };
  const client = {
    channels: { fetch: vi.fn(async () => channel) },
    guilds: { fetch: vi.fn(async () => ({})) },
  } as unknown as Client;
  return { client, cache, permissionOverwrites };
}

describe("TicketService.removeParticipant", () => {
  it("deletes the user's permission overwrite on the ticket channel", async () => {
    const { client, cache, permissionOverwrites } = fakeBot({
      memberIds: ["owner-1", "guest-1"],
    });
    const service = new TicketService(client);

    const result = await service.removeParticipant("channel-1", "guest-1");

    expect(result).toEqual({ removed: true });
    expect(permissionOverwrites.delete).toHaveBeenCalledWith("guest-1");
    expect([...cache.keys()]).toEqual(["owner-1"]);
  });

  it("reports a user without an overwrite as not a participant", async () => {
    const { client, permissionOverwrites } = fakeBot({
      memberIds: ["owner-1"],
    });
    const service = new TicketService(client);

    const result = await service.removeParticipant("channel-1", "guest-1");

    expect(result).toEqual({ removed: false, reason: "not-participant" });
    expect(permissionOverwrites.delete).not.toHaveBeenCalled();
  });

  it("reports a channel error for a channel that is not a guild text channel", async () => {
    const { client } = fakeBot({
      memberIds: ["guest-1"],
      type: ChannelType.GuildVoice,
    });
    const service = new TicketService(client);

    const result = await service.removeParticipant("channel-1", "guest-1");

    expect(result).toEqual({ removed: false, reason: "channel-error" });
  });

  it("reports a channel error when Discord rejects the change", async () => {
    const { client } = fakeBot({
      memberIds: ["guest-1"],
      failingIds: ["guest-1"],
    });
    const service = new TicketService(client);

    const result = await service.removeParticipant("channel-1", "guest-1");

    expect(result).toEqual({ removed: false, reason: "channel-error" });
  });
});
