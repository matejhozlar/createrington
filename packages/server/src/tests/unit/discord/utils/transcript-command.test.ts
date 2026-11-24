import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const transcript = vi.hoisted(() => ({
  fetchRecentMessages: vi.fn(),
  fetchMessagesSince: vi.fn(),
  buildChannelTranscript: vi.fn(),
}));

const replyError = vi.hoisted(() => vi.fn());

vi.mock("@/discord/constants", () => ({ Discord: {} }));

vi.mock("@/discord/utils/interaction-reply", () => ({ replyError }));

vi.mock("@/discord/utils/channel-transcript", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/discord/utils/channel-transcript")
  >()),
  ...transcript,
}));

import { captureDiscussion } from "@/discord/utils/transcript-command";

const CHANNEL_ID = "100";
const FIRST_ID = "200000000000000001";
const LAST_ID = "200000000000000009";

function link(messageId: string): string {
  return `https://discord.com/channels/1/${CHANNEL_ID}/${messageId}`;
}

interface FakeOptions {
  messages?: number;
  first_message?: string;
  last_message?: string;
  user?: { id: string; username: string };
}

function fakeInteraction(options: FakeOptions): ChatInputCommandInteraction {
  const values: Record<string, unknown> = { ...options };
  const get = (name: string) => values[name] ?? null;
  return {
    channel: {
      id: CHANNEL_ID,
      name: "bug-reports",
      isTextBased: () => true,
      isDMBased: () => false,
    },
    options: { getString: get, getInteger: get, getUser: get },
    deferReply: vi.fn(async () => undefined),
    user: { id: "555", username: "matej" },
  } as unknown as ChatInputCommandInteraction;
}

describe("captureDiscussion", () => {
  beforeEach(() => {
    replyError.mockReset();
    transcript.fetchRecentMessages
      .mockReset()
      .mockResolvedValue({ messages: [{ id: "1" }], hasMore: false });
    transcript.fetchMessagesSince
      .mockReset()
      .mockResolvedValue({ messages: [{ id: "1" }], hasMore: false });
    transcript.buildChannelTranscript.mockReset().mockReturnValue({
      text: "[2026-11-10 12:00 UTC] steve: the map is down",
      messageCount: 1,
      firstMessageUrl: null,
    });
  });

  it("reads the latest 50 messages from anyone when no option is given", async () => {
    const discussion = await captureDiscussion(fakeInteraction({}));

    expect(transcript.fetchRecentMessages).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHANNEL_ID }),
      50,
      { untilId: undefined, authorId: undefined },
    );
    expect(discussion?.request.messageCount).toBe(1);
  });

  it("reads the given number of messages up to last_message from the given user", async () => {
    const discussion = await captureDiscussion(
      fakeInteraction({
        messages: 20,
        last_message: link(LAST_ID),
        user: { id: "777", username: "steve" },
      }),
    );

    expect(transcript.fetchRecentMessages).toHaveBeenCalledWith(
      expect.anything(),
      20,
      { untilId: LAST_ID, authorId: "777" },
    );
    expect(discussion?.summary).toContain("from <@777>");
  });

  it("reads from first_message up to last_message", async () => {
    await captureDiscussion(
      fakeInteraction({ first_message: FIRST_ID, last_message: LAST_ID }),
    );

    expect(transcript.fetchMessagesSince).toHaveBeenCalledWith(
      expect.anything(),
      FIRST_ID,
      500,
      { untilId: LAST_ID, authorId: undefined },
    );
    expect(transcript.fetchRecentMessages).not.toHaveBeenCalled();
  });

  it("rejects a first_message newer than last_message before reading anything", async () => {
    const interaction = fakeInteraction({
      first_message: LAST_ID,
      last_message: FIRST_ID,
    });

    const discussion = await captureDiscussion(interaction);

    expect(discussion).toBeNull();
    expect(replyError).toHaveBeenCalledWith(
      interaction,
      "Messages out of order",
      expect.any(String),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects a last_message link to another channel", async () => {
    const interaction = fakeInteraction({
      last_message: `https://discord.com/channels/1/999/${LAST_ID}`,
    });

    const discussion = await captureDiscussion(interaction);

    expect(discussion).toBeNull();
    expect(replyError).toHaveBeenCalledWith(
      interaction,
      "Invalid message link",
      expect.any(String),
    );
  });

  it("rejects messages combined with first_message", async () => {
    const interaction = fakeInteraction({
      messages: 10,
      first_message: FIRST_ID,
    });

    const discussion = await captureDiscussion(interaction);

    expect(discussion).toBeNull();
    expect(replyError).toHaveBeenCalledWith(
      interaction,
      "Pick one option",
      expect.any(String),
    );
  });

  it("says the user has nothing to read when the filter leaves no messages", async () => {
    transcript.buildChannelTranscript.mockReturnValue({
      text: "",
      messageCount: 0,
      firstMessageUrl: null,
    });
    const interaction = fakeInteraction({
      user: { id: "777", username: "steve" },
    });

    const discussion = await captureDiscussion(interaction);

    expect(discussion).toBeNull();
    expect(replyError).toHaveBeenCalledWith(
      interaction,
      "Nothing to read",
      expect.stringContaining("<@777>"),
    );
  });
});
