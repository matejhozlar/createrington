import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";
import type { Client } from "discord.js";
import type { CachedMessage } from "@createrington/shared/socket";

vi.mock("@/config", () => ({
  default: {
    redis: { url: null },
    discord: { guild: { id: "guild", roles: {}, channels: {} } },
  },
}));
vi.mock("@/db", () => ({ Q: { player: { findAll: vi.fn(async () => []) } } }));

import { MessageCacheService } from "@/services/discord/message/cache/message-cache.service";

const SERVER_ID = 1;
const CHANNEL_ID = "chat";

interface FakeMember {
  displayName: string;
}

interface FakeAuthor {
  id: string;
  username: string;
  displayName: string;
  bot?: boolean;
}

function fakeGuild(members: Record<string, FakeMember> = {}) {
  const cache = new Map(Object.entries(members));
  return {
    members: {
      cache,
      fetch: vi.fn(async (_options: { user: string[] }) => {}),
    },
  };
}

type FakeGuild = ReturnType<typeof fakeGuild>;

function fakeMessage(
  guild: FakeGuild,
  id: string,
  author: FakeAuthor,
  extra: { webhookId?: string } = {},
) {
  return {
    id,
    channelId: CHANNEL_ID,
    webhookId: extra.webhookId ?? null,
    author: {
      bot: false,
      tag: author.username,
      displayAvatarURL: () => `https://cdn/${author.id}.png`,
      ...author,
    },
    get member() {
      return guild.members.cache.get(author.id) ?? null;
    },
    content: "hello",
    createdAt: new Date(0),
    editedAt: null,
    attachments: new Map(),
    embeds: [],
    reference: null,
  };
}

function fakeBot(guild: FakeGuild, history: ReturnType<typeof fakeMessage>[]) {
  const bot = new EventEmitter() as EventEmitter & Record<string, unknown>;
  bot.user = { id: "bot" };
  bot.channels = {
    fetch: vi.fn(async () => ({
      id: CHANNEL_ID,
      guild,
      send: () => {},
      messages: {
        fetch: vi.fn(async () => new Map(history.map((m) => [m.id, m]))),
      },
    })),
  };
  return bot;
}

async function startService(
  guild: FakeGuild,
  history: ReturnType<typeof fakeMessage>[] = [],
) {
  const bot = fakeBot(guild, history);
  const service = new MessageCacheService(bot as unknown as Client, {
    servers: [{ serverId: SERVER_ID, channelId: CHANNEL_ID }],
    loadHistoryOnStartup: history.length > 0,
    botConfig: { createringtonBotId: "relay" },
  });
  await service.initialize();
  return { bot, service };
}

function namesById(service: MessageCacheService) {
  return Object.fromEntries(
    service
      .getMessages(SERVER_ID)
      .map((m: CachedMessage) => [m.messageId, m.authorDisplayname]),
  );
}

describe("MessageCacheService author display name", () => {
  it("uses the server nickname of a live message's author", async () => {
    const guild = fakeGuild({ u1: { displayName: "Server Nick" } });
    const { bot, service } = await startService(guild);

    bot.emit(
      "messageCreate",
      fakeMessage(guild, "m1", {
        id: "u1",
        username: "account",
        displayName: "Global Name",
      }),
    );

    expect(namesById(service)).toEqual({ m1: "Server Nick" });
  });

  it("falls back to the account display name when the author is not a member", async () => {
    const guild = fakeGuild();
    const { bot, service } = await startService(guild);

    bot.emit(
      "messageCreate",
      fakeMessage(guild, "m1", {
        id: "u1",
        username: "account",
        displayName: "Global Name",
      }),
    );

    expect(namesById(service)).toEqual({ m1: "Global Name" });
  });

  it("loads the uncached human authors of history before naming them", async () => {
    const guild = fakeGuild({ cached: { displayName: "Cached Nick" } });
    guild.members.fetch.mockImplementation(async () => {
      guild.members.cache.set("fresh", { displayName: "Fresh Nick" });
    });

    const { service } = await startService(guild, [
      fakeMessage(guild, "m1", {
        id: "cached",
        username: "a",
        displayName: "A",
      }),
      fakeMessage(guild, "m2", {
        id: "fresh",
        username: "b",
        displayName: "B",
      }),
      fakeMessage(guild, "m3", {
        id: "fresh",
        username: "b",
        displayName: "B",
      }),
      fakeMessage(guild, "m4", {
        id: "relay",
        username: "Relay",
        displayName: "Relay",
        bot: true,
      }),
      fakeMessage(
        guild,
        "m5",
        { id: "hook", username: "Steve", displayName: "Steve" },
        { webhookId: "hook" },
      ),
    ]);

    expect(guild.members.fetch).toHaveBeenCalledTimes(1);
    expect(guild.members.fetch).toHaveBeenCalledWith({ user: ["fresh"] });
    expect(namesById(service)).toEqual({
      m1: "Cached Nick",
      m2: "Fresh Nick",
      m3: "Fresh Nick",
      m4: "Relay",
      m5: "Steve",
    });
  });

  it("keeps the history with account names when the member lookup fails", async () => {
    const guild = fakeGuild();
    guild.members.fetch.mockRejectedValue(new Error("GuildMembersTimeout"));

    const { service } = await startService(guild, [
      fakeMessage(guild, "m1", {
        id: "u1",
        username: "account",
        displayName: "Global Name",
      }),
    ]);

    expect(namesById(service)).toEqual({ m1: "Global Name" });
  });
});
