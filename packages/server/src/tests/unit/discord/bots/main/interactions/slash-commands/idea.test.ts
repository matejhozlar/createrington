import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const intake = vi.hoisted(() => ({
  start: vi.fn(),
  waitForOutcome: vi.fn(),
  apply: vi.fn(),
}));

const messages = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "900" } },
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
  fetchRecentMessages: vi.fn(async () => ({
    messages: [{ id: "1" }],
    hasMore: false,
  })),
  fetchMessagesSince: vi.fn(),
  parseMessageReference: vi.fn(),
  buildChannelTranscript: vi.fn(() => ({
    text: "[2026-11-10 12:00 UTC] steve: rework the shops",
    messageCount: 1,
    firstMessageUrl: "https://discord.com/channels/1/100/1",
  })),
}));

vi.mock("@/services/claude-automation/session-client", () => ({
  AutomationStartError: class extends Error {},
}));

vi.mock("@/services/planning-intake/planning-intake.service", () => ({
  planningIntakeService: intake,
}));

import handler from "@/discord/bots/main/interactions/slash-commands/admin/idea";

const { execute } = handler;

const PROPOSED = {
  status: "completed",
  result: "proposed",
  proposal: {
    action: "create",
    title: "Rework the shops",
    body: "Shops should sell claim upgrades.",
    category: "modpack",
    subcategoryId: null,
  },
  reason: null,
};

const SAVED = {
  kind: "created",
  itemId: 31,
  title: "Rework the shops",
  url: "https://createrington.test/admin/planning/31",
};

function fakeInteraction() {
  const editReply = vi.fn(async () => undefined);
  const interaction = {
    channel: {
      id: "100",
      name: "staff",
      isTextBased: () => true,
      isDMBased: () => false,
    },
    options: {
      getString: () => null,
      getInteger: () => null,
      getUser: () => null,
    },
    deferReply: vi.fn(async () => undefined),
    editReply,
    user: { id: "555", username: "matej", tag: "matej" },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, editReply };
}

describe("/idea", () => {
  beforeEach(() => {
    intake.start.mockReset().mockResolvedValue({ sessionId: 5 });
    intake.waitForOutcome.mockReset().mockResolvedValue(PROPOSED);
    intake.apply.mockReset().mockResolvedValue(SAVED);
    messages.send.mockReset().mockResolvedValue({ id: "1" });
  });

  it("saves the proposal as the admin who ran it and links the new card", async () => {
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() => expect(messages.send).toHaveBeenCalledTimes(1));
    expect(intake.apply).toHaveBeenCalledWith(PROPOSED.proposal, {
      discordId: "555",
      sourceUrl: "https://discord.com/channels/1/100/1",
    });
    expect(messages.send).toHaveBeenCalledWith({
      channelId: "900",
      content: "<@555> `/idea` in <#100>",
      embeds: expect.objectContaining({
        kind: "success",
        title: "Draft added to planning",
        description:
          "[Rework the shops](https://createrington.test/admin/planning/31)",
      }),
      allowedMentions: { users: ["555"] },
    });
    expect(editReply).toHaveBeenLastCalledWith({
      embeds: [expect.objectContaining({ title: "Draft added to planning" })],
    });
  });

  it("says so when the discussion went onto an existing card as a comment", async () => {
    intake.apply.mockResolvedValue({ ...SAVED, kind: "commented" });
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() =>
      expect(editReply).toHaveBeenLastCalledWith({
        embeds: [expect.objectContaining({ title: "Comment added to a plan" })],
      }),
    );
  });

  it("writes nothing when Claude finds nothing worth keeping", async () => {
    intake.waitForOutcome.mockResolvedValue({
      status: "completed",
      result: "no_card",
      proposal: null,
      reason: "Only small talk.",
    });
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() =>
      expect(editReply).toHaveBeenLastCalledWith({
        embeds: [
          expect.objectContaining({
            kind: "info",
            title: "Nothing to add",
            description: "Only small talk.",
          }),
        ],
      }),
    );
    expect(intake.apply).not.toHaveBeenCalled();
  });

  it("reports a proposal the board refused as not saved", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => logger);
    intake.apply.mockRejectedValue(new Error("planning_item 7 not found"));
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() =>
      expect(editReply).toHaveBeenLastCalledWith({
        embeds: [
          expect.objectContaining({ kind: "error", title: "Could not save" }),
        ],
      }),
    );
    error.mockRestore();
  });

  it("adds nothing when the session outlasts the wait", async () => {
    intake.waitForOutcome.mockResolvedValue(null);
    const { interaction, editReply } = fakeInteraction();

    await execute(interaction);

    await vi.waitFor(() =>
      expect(editReply).toHaveBeenLastCalledWith({
        embeds: [
          expect.objectContaining({ kind: "error", title: "Timed out" }),
        ],
      }),
    );
    expect(intake.apply).not.toHaveBeenCalled();
  });
});
