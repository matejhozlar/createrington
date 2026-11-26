import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChannelType,
  Collection,
  OverwriteType,
  type Client,
} from "discord.js";

const ticketGet = vi.hoisted(() => vi.fn());
const ticketFindAll = vi.hoisted(() => vi.fn());
const allocateNumber = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  delete: vi.fn(),
  updateMetadata: vi.fn(),
}));
const sendMessage = vi.hoisted(() => vi.fn());
const writeFile = vi.hoisted(() => vi.fn(async () => undefined));
const access = vi.hoisted(() => vi.fn(async () => undefined));
const createTranscript = vi.hoisted(() =>
  vi.fn(async () => Buffer.from("<html></html>")),
);

vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(async () => undefined), writeFile, access },
}));

vi.mock("discord-html-transcripts", () => ({
  createTranscript,
  ExportReturnType: { Buffer: "buffer" },
}));

vi.mock("@/config", () => ({
  default: {
    storage: { path: "storage" },
    discord: { guild: { id: "guild-1", categories: { tickets: "cat-1" } } },
  },
}));

vi.mock("@/db", () => ({
  Q: {
    ticket: { get: ticketGet, findAll: ticketFindAll, allocateNumber },
    player: { find: vi.fn(async () => null) },
  },
  ticketRepo: repository,
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { TRANSCRIPTS: "transcripts-1" } },
    Roles: { ADMIN: "admin-role", OWNER: "owner-role" },
    Messages: { send: sendMessage },
  },
}));

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    ticket: {
      close: (closedBy: string) => ({ build: () => [closedBy] }),
      welcome: () => ({ build: () => [] }),
    },
  },
}));

import { TicketService } from "@/services/discord/tickets/ticket.service";
import { TicketType } from "@/services/discord/tickets/types";

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

describe("TicketService.openTicket", () => {
  function serviceCreatingInto(open: Array<{ creatorDiscordId: string }>) {
    const service = new TicketService(fakeBot({}).client);
    ticketFindAll.mockImplementation(
      async ({ creatorDiscordId }: { creatorDiscordId: string }) =>
        open.filter((ticket) => ticket.creatorDiscordId === creatorDiscordId),
    );
    const createTicket = vi
      .spyOn(
        service as unknown as {
          createTicket: (options: { creatorId: string }) => Promise<unknown>;
        },
        "createTicket",
      )
      .mockImplementation(async ({ creatorId }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        const ticket = { creatorDiscordId: creatorId, channelId: "channel-1" };
        open.push(ticket);
        return { ticket, channel: { id: "channel-1" } };
      });
    return { service, createTicket };
  }

  it("opens one ticket when the same member asks twice at once", async () => {
    const { service, createTicket } = serviceCreatingInto([]);
    const request = { type: TicketType.GENERAL, creatorId: "user-1" };

    const results = await Promise.all([
      service.openTicket(request),
      service.openTicket(request),
    ]);

    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.created)).toEqual([true, false]);
    expect(results[1].ticket.channelId).toBe("channel-1");
  });

  it("opens a ticket each for two members asking at once", async () => {
    const { service, createTicket } = serviceCreatingInto([]);

    const results = await Promise.all([
      service.openTicket({ type: TicketType.GENERAL, creatorId: "user-1" }),
      service.openTicket({ type: TicketType.GENERAL, creatorId: "user-2" }),
    ]);

    expect(createTicket).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.created)).toEqual([true, true]);
  });
});

describe("TicketService.openTicket when creating fails", () => {
  function serviceWithChannel() {
    const channel = { id: "channel-9", delete: vi.fn(async () => undefined) };
    const client = {
      user: { id: "bot-1" },
      guilds: {
        fetch: vi.fn(async () => ({
          id: "guild-1",
          channels: { create: vi.fn(async () => channel) },
        })),
      },
    } as unknown as Client;
    return { service: new TicketService(client), channel };
  }

  const request = { type: TicketType.GENERAL, creatorId: "user-1" };

  beforeEach(() => {
    ticketFindAll.mockReset().mockResolvedValue([]);
    allocateNumber.mockReset().mockResolvedValue(42);
    repository.create.mockReset();
    repository.delete.mockReset();
    sendMessage.mockReset();
  });

  it("discards the channel and the ticket when the welcome message fails", async () => {
    const { service, channel } = serviceWithChannel();
    repository.create.mockResolvedValue({
      id: 9,
      creatorDiscordId: "user-1",
    });
    sendMessage.mockRejectedValue(new Error("Discord unavailable"));

    await expect(service.openTicket(request)).rejects.toThrow(
      "Discord unavailable",
    );

    expect(repository.delete).toHaveBeenCalledWith(9, "bot-1");
    expect(channel.delete).toHaveBeenCalledOnce();
  });

  it("deletes the channel when the ticket row cannot be stored", async () => {
    const { service, channel } = serviceWithChannel();
    repository.create.mockRejectedValue(new Error("connection lost"));

    await expect(service.openTicket(request)).rejects.toThrow(
      "connection lost",
    );

    expect(repository.delete).not.toHaveBeenCalled();
    expect(channel.delete).toHaveBeenCalledOnce();
  });
});

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

describe("TicketService.closeTicket", () => {
  const ticket = {
    id: 7,
    ticketNumber: 12,
    status: "open",
    channelId: "channel-1",
    creatorDiscordId: "owner-1",
  };

  beforeEach(() => {
    ticketGet.mockReset();
    ticketGet.mockResolvedValue(ticket);
    repository.close.mockReset();
    repository.close.mockResolvedValue({ ...ticket, status: "closed" });
    repository.updateMetadata.mockReset();
    sendMessage.mockReset();
    sendMessage.mockResolvedValue({ id: "message-1" });
  });

  it("posts the closure message again for a ticket closed without one", async () => {
    ticketGet.mockResolvedValue({
      ...ticket,
      status: "closed",
      closedByDiscordId: "admin-0",
      metadata: {},
    });
    const service = new TicketService(fakeBot({}).client);

    await service.closeTicket(7, "admin-1");

    expect(repository.close).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "channel-1", embeds: ["admin-0"] }),
    );
    expect(repository.updateMetadata).toHaveBeenCalledWith(7, {
      closeMessageId: "message-1",
    });
  });

  it("refuses to close a ticket again once its closure message is posted", async () => {
    ticketGet.mockResolvedValue({
      ...ticket,
      status: "closed",
      metadata: { closeMessageId: "message-0" },
    });
    repository.close.mockRejectedValue(
      new Error("Ticket #12 is already closed"),
    );
    const service = new TicketService(fakeBot({}).client);

    await expect(service.closeTicket(7, "admin-1")).rejects.toThrow(
      "already closed",
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("locks out the owner and removes everyone added to the ticket", async () => {
    const { client, cache, permissionOverwrites } = fakeBot({
      roleIds: ["guild-1", "admin-role"],
      memberIds: ["owner-1", "guest-1", "guest-2"],
    });
    const service = new TicketService(client);

    await service.closeTicket(7, "admin-1");

    expect(permissionOverwrites.edit).toHaveBeenCalledWith(
      "owner-1",
      { ViewChannel: false, SendMessages: false },
      { type: OverwriteType.Member },
    );
    expect([...cache.keys()]).toEqual(["guild-1", "admin-role", "owner-1"]);
  });

  it("keeps removing the others when one removal fails", async () => {
    const { client, cache } = fakeBot({
      memberIds: ["owner-1", "guest-1", "guest-2"],
      failingIds: ["guest-1"],
    });
    const service = new TicketService(client);

    await service.closeTicket(7, "admin-1");

    expect([...cache.keys()]).toEqual(["owner-1", "guest-1"]);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("TicketService.ensureTranscript", () => {
  const ticket = {
    id: 7,
    ticketNumber: 12,
    status: "closed",
    channelId: "channel-1",
    creatorDiscordId: "owner-1",
  };

  beforeEach(() => {
    ticketGet.mockReset();
    repository.updateMetadata.mockReset();
    createTranscript.mockClear();
    writeFile.mockClear();
    access.mockReset().mockResolvedValue(undefined);
  });

  it("returns the stored transcript without generating a new one", async () => {
    ticketGet.mockResolvedValue({
      ...ticket,
      metadata: { transcriptPath: "storage/transcripts/ticket-12-1.html" },
    });
    const service = new TicketService(fakeBot({}).client);

    const result = await service.ensureTranscript(7);

    expect(result).toEqual({
      transcriptPath: "storage/transcripts/ticket-12-1.html",
      generated: false,
    });
    expect(createTranscript).not.toHaveBeenCalled();
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it("generates, writes and stores a transcript when the ticket has none", async () => {
    ticketGet.mockResolvedValue({ ...ticket, metadata: {} });
    const service = new TicketService(fakeBot({}).client);

    const result = await service.ensureTranscript(7);

    expect(result.generated).toBe(true);
    expect(result.transcriptPath).toMatch(/ticket-12-\d+\.html$/);
    expect(writeFile).toHaveBeenCalledWith(
      result.transcriptPath,
      expect.any(Buffer),
    );
    expect(repository.updateMetadata).toHaveBeenCalledWith(7, {
      transcriptPath: result.transcriptPath,
    });
  });

  it("regenerates the transcript when the stored file is gone", async () => {
    ticketGet.mockResolvedValue({
      ...ticket,
      metadata: { transcriptPath: "storage/transcripts/ticket-12-1.html" },
    });
    access.mockRejectedValue(new Error("ENOENT"));
    const service = new TicketService(fakeBot({}).client);

    const result = await service.ensureTranscript(7);

    expect(result.generated).toBe(true);
    expect(result.transcriptPath).not.toBe(
      "storage/transcripts/ticket-12-1.html",
    );
    expect(repository.updateMetadata).toHaveBeenCalledWith(7, {
      transcriptPath: result.transcriptPath,
    });
  });
});
