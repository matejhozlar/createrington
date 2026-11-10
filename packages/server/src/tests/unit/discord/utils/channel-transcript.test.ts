import { describe, expect, it, vi } from "vitest";
import {
  Collection,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import {
  buildChannelTranscript,
  fetchMessagesSince,
  fetchRecentMessages,
  parseMessageReference,
} from "@/discord/utils/channel-transcript";

const CHANNEL_ID = "111111111111111111";
const BASE_TIME = Date.UTC(2026, 10, 10, 12, 0);

interface FakeMessageOptions {
  content?: string;
  username?: string;
  displayName?: string;
  bot?: boolean;
  replyTo?: string;
}

function fakeMessage(index: number, options: FakeMessageOptions = {}): Message {
  const id = String(100000000000000000n + BigInt(index));
  const createdTimestamp = BASE_TIME + index * 60_000;
  const username = options.username ?? `player${index}`;
  return {
    id,
    createdTimestamp,
    createdAt: new Date(createdTimestamp),
    cleanContent: options.content ?? `message ${index}`,
    attachments: new Collection(),
    embeds: [],
    member: options.displayName ? { displayName: options.displayName } : null,
    author: { username, globalName: null, bot: options.bot ?? false },
    reference: options.replyTo ? { messageId: options.replyTo } : null,
    url: `https://discord.com/channels/1/${CHANNEL_ID}/${id}`,
  } as unknown as Message;
}

function fakeChannel(messages: Message[]): {
  channel: GuildTextBasedChannel;
  fetch: ReturnType<typeof vi.fn>;
} {
  const newestFirst = [...messages].sort(
    (a, b) => b.createdTimestamp - a.createdTimestamp,
  );
  const toCollection = (list: Message[]): Collection<string, Message> =>
    new Collection(list.map((m) => [m.id, m]));
  const fetch = vi.fn(
    async (
      query: string | { limit: number; before?: string; after?: string },
    ) => {
      if (typeof query === "string") {
        return messages.find((m) => m.id === query);
      }
      if (query.after) {
        const anchor = BigInt(query.after);
        const newer = newestFirst.filter((m) => BigInt(m.id) > anchor);
        return toCollection(newer.slice(-query.limit));
      }
      const older = query.before
        ? newestFirst.filter((m) => BigInt(m.id) < BigInt(query.before!))
        : newestFirst;
      return toCollection(older.slice(0, query.limit));
    },
  );
  return {
    channel: { messages: { fetch } } as unknown as GuildTextBasedChannel,
    fetch,
  };
}

describe("parseMessageReference", () => {
  it("accepts a bare message id", () => {
    expect(parseMessageReference(" 123456789012345678 ", CHANNEL_ID)).toBe(
      "123456789012345678",
    );
  });

  it("accepts a link to a message in the same channel", () => {
    expect(
      parseMessageReference(
        `https://discord.com/channels/222/${CHANNEL_ID}/333333333333333333`,
        CHANNEL_ID,
      ),
    ).toBe("333333333333333333");
  });

  it("rejects a link to a message in another channel", () => {
    expect(
      parseMessageReference(
        "https://discord.com/channels/222/999/333333333333333333",
        CHANNEL_ID,
      ),
    ).toBeNull();
  });

  it("rejects text that is neither an id nor a message link", () => {
    expect(parseMessageReference("the message above", CHANNEL_ID)).toBeNull();
  });
});

describe("fetchRecentMessages", () => {
  it("pages backwards past Discord's 100-message limit and returns oldest first", async () => {
    const all = Array.from({ length: 250 }, (_, i) => fakeMessage(i));
    const { channel, fetch } = fakeChannel(all);

    const result = await fetchRecentMessages(channel, 230);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(230);
    expect(result[0].id).toBe(all[20].id);
    expect(result.at(-1)!.id).toBe(all[249].id);
  });

  it("stops when the channel has fewer messages than requested", async () => {
    const all = Array.from({ length: 30 }, (_, i) => fakeMessage(i));
    const { channel, fetch } = fakeChannel(all);

    const result = await fetchRecentMessages(channel, 500);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(30);
  });
});

describe("fetchMessagesSince", () => {
  it("reads from the linked message up to the newest one", async () => {
    const all = Array.from({ length: 250 }, (_, i) => fakeMessage(i));
    const { channel } = fakeChannel(all);

    const { messages, hasMore } = await fetchMessagesSince(
      channel,
      all[40].id,
      500,
    );

    expect(messages).toHaveLength(210);
    expect(messages[0].id).toBe(all[40].id);
    expect(messages.at(-1)!.id).toBe(all[249].id);
    expect(hasMore).toBe(false);
  });

  it("stops at the cap and reports that more messages follow", async () => {
    const all = Array.from({ length: 250 }, (_, i) => fakeMessage(i));
    const { channel } = fakeChannel(all);

    const { messages, hasMore } = await fetchMessagesSince(
      channel,
      all[0].id,
      120,
    );

    expect(messages).toHaveLength(120);
    expect(messages.at(-1)!.id).toBe(all[119].id);
    expect(hasMore).toBe(true);
  });

  it("does not report more messages when the cap is met exactly", async () => {
    const all = Array.from({ length: 120 }, (_, i) => fakeMessage(i));
    const { channel } = fakeChannel(all);

    const { messages, hasMore } = await fetchMessagesSince(
      channel,
      all[0].id,
      120,
    );

    expect(messages).toHaveLength(120);
    expect(hasMore).toBe(false);
  });
});

function encodedSize(text: string): number {
  return Buffer.byteLength(JSON.stringify(text), "utf8");
}

describe("buildChannelTranscript", () => {
  it("names authors, marks bots and resolves replies within the transcript", () => {
    const question = fakeMessage(1, {
      content: "the map is down",
      username: "steve",
      displayName: "Steve",
    });
    const answer = fakeMessage(2, {
      content: "looking",
      username: "alex",
      replyTo: question.id,
    });
    const bot = fakeMessage(3, { content: "Server online", bot: true });

    const transcript = buildChannelTranscript([question, answer, bot]);

    expect(transcript.text.split("\n")).toEqual([
      "[2026-11-10 12:01 UTC] Steve (@steve): the map is down",
      "[2026-11-10 12:02 UTC] alex (replying to Steve (@steve)): looking",
      "[2026-11-10 12:03 UTC] player3 [bot]: Server online",
    ]);
    expect(transcript.messageCount).toBe(3);
    expect(transcript.firstMessageUrl).toBe(question.url);
  });

  it("skips messages with nothing in them", () => {
    const transcript = buildChannelTranscript([
      fakeMessage(1, { content: "" }),
      fakeMessage(2),
    ]);

    expect(transcript.messageCount).toBe(1);
  });

  it("drops the oldest messages first by default when the transcript is too long", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      fakeMessage(i, { content: "x".repeat(50) }),
    );
    const lineSize = encodedSize(buildChannelTranscript([messages[0]]).text);

    const transcript = buildChannelTranscript(messages, {
      maxBytes: lineSize * 4,
    });

    expect(transcript.messageCount).toBe(4);
    expect(transcript.firstMessageUrl).toBe(messages[6].url);
  });

  it("keeps the first message and drops the newest when asked to keep the oldest", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      fakeMessage(i, { content: "x".repeat(50) }),
    );
    const lineSize = encodedSize(buildChannelTranscript([messages[0]]).text);

    const transcript = buildChannelTranscript(messages, {
      keep: "oldest",
      maxBytes: lineSize * 4,
    });

    expect(transcript.messageCount).toBe(4);
    expect(transcript.firstMessageUrl).toBe(messages[0].url);
    expect(transcript.text.split("\n").at(-1)).toContain("player3");
  });

  it("measures the cap in JSON-encoded bytes, not characters", () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      fakeMessage(i, { content: 'řeč "🙂"\n'.repeat(20) }),
    );
    const maxBytes = 3000;

    const transcript = buildChannelTranscript(messages, { maxBytes });

    expect(transcript.messageCount).toBeGreaterThan(0);
    expect(transcript.text.length).toBeLessThan(maxBytes);
    expect(encodedSize(transcript.text)).toBeLessThanOrEqual(maxBytes);
    const oneMore = buildChannelTranscript(
      messages.slice(-(transcript.messageCount + 1)),
    );
    expect(encodedSize(oneMore.text)).toBeGreaterThan(maxBytes);
  });
});
