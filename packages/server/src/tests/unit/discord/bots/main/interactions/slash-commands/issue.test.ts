import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const triage = vi.hoisted(() => ({
  start: vi.fn(),
  waitForOutcome: vi.fn(),
}));

const messages = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "900" } },
    Users: { mention: (id: string) => `<@${id}>` },
    Messages: messages,
  },
}));

vi.mock("@/discord/embeds", () => {
  const builder = (kind: string, title: string, description?: string) => ({
    build: () => ({ kind, title, description }),
  });
  return {
    EmbedPresets: {
      success: (title: string, description?: string) =>
        builder("success", title, description),
      info: (title: string, description?: string) =>
        builder("info", title, description),
      error: (title: string, description?: string) =>
        builder("error", title, description),
    },
  };
});

vi.mock("@/discord/utils/interaction-reply", () => ({
  replyError: vi.fn(),
}));

vi.mock("@/discord/utils/channel-transcript", () => ({
  TRANSCRIPT_MAX_MESSAGES: 500,
  fetchRecentMessages: vi.fn(async () => [{ id: "1" }]),
  fetchMessagesSince: vi.fn(),
  parseMessageReference: vi.fn(),
  buildChannelTranscript: vi.fn(() => ({
    text: "[2026-11-10 12:00 UTC] steve: the map is down",
    messageCount: 1,
    firstMessageUrl: null,
  })),
}));

vi.mock("@/services/issue-triage", () => ({
  IssueTriageError: class extends Error {},
  issueTriageService: triage,
}));

import { execute } from "@/discord/bots/main/interactions/slash-commands/admin/issue";

const FILED = {
  status: "completed",
  result: "filed",
  issue: {
    repo: "Createrington/app",
    number: 42,
    title: "Map is down",
    url: "https://gitea.example/Createrington/app/issues/42",
  },
  reason: null,
};

function fakeInteraction() {
  const editReply = vi.fn(async () => undefined);
  const interaction = {
    channel: {
      id: "100",
      name: "bug-reports",
      isTextBased: () => true,
      isDMBased: () => false,
    },
    options: { getString: () => null, getInteger: () => null },
    deferReply: vi.fn(async () => undefined),
    editReply,
    user: { id: "555", username: "matej", tag: "matej" },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, editReply };
}

describe("/issue", () => {
  beforeEach(() => {
    triage.start.mockResolvedValue({ sessionId: 5 });
    triage.waitForOutcome.mockResolvedValue(FILED);
    messages.send.mockReset();
  });

  it("posts the result to admin notifications, pinging only the admin who ran it", async () => {
    messages.send.mockResolvedValue({ success: true, messageId: "1" });
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() => expect(messages.send).toHaveBeenCalledTimes(1));
    expect(messages.send).toHaveBeenCalledWith({
      channelId: "900",
      content: "<@555> `/issue` in <#100>",
      embeds: expect.objectContaining({
        kind: "success",
        title: "Issue filed",
      }),
      allowedMentions: { users: ["555"] },
    });
    expect(editReply).toHaveBeenLastCalledWith({
      embeds: [expect.objectContaining({ title: "Issue filed" })],
    });
  });

  it("still updates the private reply when the channel post fails", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    messages.send.mockResolvedValue({
      success: false,
      error: "Channel not found or not sendable",
    });
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() =>
      expect(editReply).toHaveBeenLastCalledWith({
        embeds: [expect.objectContaining({ title: "Issue filed" })],
      }),
    );
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
