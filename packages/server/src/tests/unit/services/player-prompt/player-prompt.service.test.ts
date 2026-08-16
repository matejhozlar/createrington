import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";

interface StoredEntry {
  entryNumber: number;
  responseText: string;
  submittedAt: Date;
}

let prompt: PlayerPrompt | null;
let entries: StoredEntry[];
let appendCalls: Array<{
  maxEntries: number | null;
  cooldownSeconds: number | null;
  responseText: string;
}>;
let upsertCalls: Array<{ responseText: string }>;
// Simulates a concurrent submission landing between the gate read and the
// insert, which the real query catches via its HAVING clause. The entry it
// would have written is pushed here so the follow-up re-read sees it.
let raceOnAppend: StoredEntry | null;
let promptDeleteCalls: number[];
let messageDeleteCalls: Array<{ channelId: string; messageId: string }>;
let messageDeleteResult: { success: boolean; error?: string };

vi.mock("@/db", () => {
  const response = {
    findLatestEntry: async () => entries.at(-1) ?? null,
    getEntryStats: async () => ({
      entryCount: entries.length,
      lastEntryNumber: entries.at(-1)?.entryNumber ?? 0,
      lastSubmittedAt: entries.at(-1)?.submittedAt ?? null,
    }),
    upsertSingleEntry: async (data: { responseText: string }) => {
      upsertCalls.push(data);
      return data;
    },
    appendEntry: async (data: {
      maxEntries: number | null;
      cooldownSeconds: number | null;
      responseText: string;
    }) => {
      appendCalls.push(data);
      if (raceOnAppend) {
        entries.push(raceOnAppend);
        raceOnAppend = null;
        return null;
      }
      if (data.maxEntries !== null && entries.length >= data.maxEntries) {
        return null;
      }
      const last = entries.at(-1);
      if (
        data.cooldownSeconds !== null &&
        last &&
        last.submittedAt.getTime() + data.cooldownSeconds * 1000 > Date.now()
      ) {
        return null;
      }
      const entry = {
        entryNumber: (entries.at(-1)?.entryNumber ?? 0) + 1,
        responseText: data.responseText,
        submittedAt: new Date(),
      };
      entries.push(entry);
      return entry;
    },
  };

  return {
    Q: {
      player: {
        find: async () => ({
          minecraftUuid: "11111111-1111-1111-1111-111111111111",
        }),
        prompt: {
          find: async () => prompt,
          delete: async (identifier: { id: number }) => {
            promptDeleteCalls.push(identifier.id);
            prompt = null;
          },
          response,
        },
      },
    },
  };
});

import { PlayerPromptService } from "@/services/player-prompt/player-prompt.service";
import type { DiscordMessageService } from "@/services/discord/message/message.service";

function makeService(messageService: Partial<DiscordMessageService> = {}) {
  return new PlayerPromptService(messageService as DiscordMessageService);
}

/** Records every message delete and replies with `messageDeleteResult`. */
function recordingMessageService(): Partial<DiscordMessageService> {
  return {
    delete: async (options: { channelId: string; messageId: string }) => {
      messageDeleteCalls.push(options);
      return messageDeleteResult;
    },
  };
}

function setPrompt(overrides: Partial<PlayerPrompt> = {}) {
  prompt = {
    id: 1,
    question: "What next?",
    description: null,
    createdBy: "admin-1",
    channelId: "channel-1",
    messageId: "message-1",
    rolePingId: null,
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 3_600_000),
    status: "active",
    entryMode: "single",
    maxEntries: null,
    cooldownSeconds: null,
    createdAt: new Date(Date.now() - 60_000),
    updatedAt: new Date(Date.now() - 60_000),
    ...overrides,
  };
  return prompt;
}

function addEntries(count: number, submittedAt = new Date()) {
  for (let i = 0; i < count; i++) {
    entries.push({
      entryNumber: entries.length + 1,
      responseText: `entry ${entries.length + 1}`,
      submittedAt,
    });
  }
}

beforeEach(() => {
  prompt = null;
  entries = [];
  appendCalls = [];
  upsertCalls = [];
  raceOnAppend = null;
  promptDeleteCalls = [];
  messageDeleteCalls = [];
  messageDeleteResult = { success: true };
});

describe("PlayerPromptService.prepareEntry", () => {
  it("refuses when the prompt no longer exists", async () => {
    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision.allowed).toBe(false);
  });

  it("refuses a prompt that is marked closed", async () => {
    setPrompt({ status: "closed" });
    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({
      allowed: false,
      message: expect.stringContaining("closed"),
    });
  });

  it("refuses a prompt whose end time has passed", async () => {
    setPrompt({ endsAt: new Date(Date.now() - 1000) });
    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision.allowed).toBe(false);
  });

  it("prefills the existing answer on a single-entry prompt", async () => {
    setPrompt();
    entries.push({
      entryNumber: 1,
      responseText: "my first answer",
      submittedAt: new Date(),
    });

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({
      allowed: true,
      prefill: "my first answer",
      entryNumber: 1,
    });
  });

  it("opens a blank modal on the next slot for a multi-entry prompt", async () => {
    setPrompt({ entryMode: "multi" });
    addEntries(2);

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({
      allowed: true,
      prefill: null,
      entryNumber: 3,
    });
  });

  it("refuses once the responder is at maxEntries", async () => {
    setPrompt({ entryMode: "multi", maxEntries: 3 });
    addEntries(3);

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({
      allowed: false,
      message: expect.stringContaining("all 3"),
    });
  });

  it("allows the last slot when one entry remains", async () => {
    setPrompt({ entryMode: "multi", maxEntries: 3 });
    addEntries(2);

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision.allowed).toBe(true);
  });

  it("refuses inside the cooldown window", async () => {
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });
    addEntries(1, new Date(Date.now() - 60_000));

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({
      allowed: false,
      message: expect.stringContaining("cooldown"),
    });
  });

  it("allows once the cooldown has lapsed", async () => {
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });
    addEntries(1, new Date(Date.now() - 601_000));

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision.allowed).toBe(true);
  });

  it("ignores the cooldown when the responder has no entries yet", async () => {
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });

    const decision = await makeService().prepareEntry(1, "user-1");
    expect(decision).toMatchObject({ allowed: true, entryNumber: 1 });
  });
});

describe("PlayerPromptService.submitResponse", () => {
  it("upserts on a single-entry prompt and offers an edit window", async () => {
    setPrompt();
    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "hello",
    });

    expect(upsertCalls).toHaveLength(1);
    expect(appendCalls).toHaveLength(0);
    expect(message).toContain("edit your response");
  });

  it("appends on a multi-entry prompt and passes the cap to the insert", async () => {
    setPrompt({ entryMode: "multi", maxEntries: 3 });
    addEntries(1);

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "second",
    });

    expect(upsertCalls).toHaveLength(0);
    expect(appendCalls[0].maxEntries).toBe(3);
    expect(message).toContain("Entry #2 recorded.");
    expect(message).toContain("You have 1 entry left.");
  });

  it("announces the final entry rather than a remaining count", async () => {
    setPrompt({ entryMode: "multi", maxEntries: 2 });
    addEntries(1);

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "last one",
    });

    expect(message).toContain("That was your last entry");
    expect(message).not.toContain("entries left");
  });

  it("points at the next allowed time when a cooldown is configured", async () => {
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "first",
    });

    expect(message).toContain("You can add another <t:");
  });

  it("points at the prompt's close time when uncapped and uncooled", async () => {
    setPrompt({ entryMode: "multi" });

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "first",
    });

    expect(message).toContain("any time before <t:");
  });

  it("reports the cap when a concurrent submission takes the last slot", async () => {
    setPrompt({ entryMode: "multi", maxEntries: 2 });
    addEntries(1);
    raceOnAppend = {
      entryNumber: 2,
      responseText: "the winner",
      submittedAt: new Date(),
    };

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "too late",
    });

    expect(message).toContain("all 2");
  });

  it("passes the cooldown to the insert so it is enforced with the write", async () => {
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });

    await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "first",
    });

    expect(appendCalls[0].cooldownSeconds).toBe(600);
  });

  it("reports the cooldown when a concurrent entry lands first", async () => {
    // Both submissions clear the gate on a lapsed cooldown; the insert is
    // what stops the second, and the responder is told when they can retry.
    setPrompt({ entryMode: "multi", cooldownSeconds: 600 });
    addEntries(1, new Date(Date.now() - 601_000));
    raceOnAppend = {
      entryNumber: 2,
      responseText: "the winner",
      submittedAt: new Date(),
    };

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "too fast",
    });

    expect(message).toContain("cooldown");
    expect(message).toContain("<t:");
  });

  it("refuses without writing when the prompt closed before submitting", async () => {
    setPrompt({ status: "closed" });

    const message = await makeService().submitResponse({
      promptId: 1,
      discordId: "user-1",
      responseText: "too late",
    });

    expect(upsertCalls).toHaveLength(0);
    expect(appendCalls).toHaveLength(0);
    expect(message).toContain("closed");
  });
});

describe("PlayerPromptService.deletePrompt", () => {
  it("reports a prompt that is already gone without deleting anything", async () => {
    const deleted = await makeService(recordingMessageService()).deletePrompt(
      1,
    );

    expect(deleted).toBeNull();
    expect(promptDeleteCalls).toHaveLength(0);
    expect(messageDeleteCalls).toHaveLength(0);
  });

  it("removes the Discord announcement along with the row", async () => {
    setPrompt();

    const deleted = await makeService(recordingMessageService()).deletePrompt(
      1,
    );

    expect(deleted).toMatchObject({ id: 1, question: "What next?" });
    expect(messageDeleteCalls).toEqual([
      { channelId: "channel-1", messageId: "message-1" },
    ]);
    expect(promptDeleteCalls).toEqual([1]);
  });

  it("still drops the row when the Discord message can't be removed", async () => {
    setPrompt();
    messageDeleteResult = { success: false, error: "Message not found" };

    const deleted = await makeService(recordingMessageService()).deletePrompt(
      1,
    );

    expect(deleted).not.toBeNull();
    expect(messageDeleteCalls).toHaveLength(1);
    // A message that can't be deleted must not strand the row in the panel.
    expect(promptDeleteCalls).toEqual([1]);
  });

  it("skips Discord entirely for a prompt that never got a message id", async () => {
    setPrompt({ messageId: null });

    await makeService(recordingMessageService()).deletePrompt(1);

    expect(messageDeleteCalls).toHaveLength(0);
    expect(promptDeleteCalls).toEqual([1]);
  });
});
