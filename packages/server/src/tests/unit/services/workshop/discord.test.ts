import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChannelType } from "discord.js";
import type { Workshop, WorkshopMod } from "@createrington/shared/db";

type Call = [name: string, payload: unknown];

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  threads: new Map<string, unknown>(),
  channelFetch: vi.fn(),
}));

const TAG_IDS: Record<string, string> = {
  Suggested: "tag-suggested",
  Approved: "tag-approved",
  "In testing": "tag-testing",
  "Coming next update": "tag-next-update",
  "In the pack": "tag-in-pack",
  "On hold": "tag-on-hold",
  Incompatible: "tag-incompatible",
  "Already covered": "tag-covered",
  "Not a good fit": "tag-not-a-good-fit",
};

const FORUM = {
  type: ChannelType.GuildForum,
  id: "forum-1",
  availableTags: Object.entries(TAG_IDS).map(([name, id]) => ({ id, name })),
  setAvailableTags: vi.fn(),
};

vi.mock("@/config", () => ({
  default: { discord: { guild: { id: "guild-1" } } },
}));
vi.mock("@/services", () => ({
  Services: { DISCORD_MAIN_BOT: "DISCORD_MAIN_BOT" },
  getService: async () => ({ channels: { fetch: state.channelFetch } }),
}));
vi.mock("@/app/middleware/error-handler", () => ({
  BadRequestError: class extends Error {},
}));
vi.mock("@/discord/constants", () => ({
  Discord: { Users: { mention: (id: string) => `<@${id}>` } },
}));
vi.mock("@/db", () => ({
  Q: {
    workshop: {
      mod: {
        updateAll: vi.fn(async () => 1),
        find: vi.fn(async () => null),
      },
    },
    curseforge: { project: { findAll: vi.fn(async () => []) } },
  },
}));

import {
  announcePackDropOut,
  announceReview,
  healThreads,
} from "@/services/workshop/discord";

function fakeThread(
  id: string,
  overrides: { archived?: boolean; appliedTags?: string[] } = {},
) {
  const thread = {
    id,
    archived: overrides.archived ?? false,
    appliedTags: overrides.appliedTags ?? [],
    parent: FORUM,
    isThread: () => true,
    edit: vi.fn(async (options: unknown) => {
      state.calls.push(["edit", options]);
      return thread;
    }),
    send: vi.fn(async (options: unknown) => {
      state.calls.push(["send", options]);
    }),
    setArchived: vi.fn(async (archived: boolean, reason?: string) => {
      state.calls.push(["setArchived", { archived, reason }]);
      thread.archived = archived;
      return thread;
    }),
  };
  state.threads.set(id, thread);
  return thread;
}

function fakeMod(overrides: Partial<WorkshopMod>): WorkshopMod {
  return {
    id: 42,
    discordThreadId: "thread-42",
    status: "approved",
    rejectReason: null,
    rejectNote: null,
    ...overrides,
  } as WorkshopMod;
}

beforeEach(() => {
  state.calls = [];
  state.threads.clear();
  state.channelFetch.mockReset();
  state.channelFetch.mockImplementation(async (id: string) => {
    const thread = state.threads.get(id);
    if (!thread) throw new Error(`no stub for ${id}`);
    return thread;
  });
});

describe("announceReview", () => {
  it("reopens, retags, posts, then closes the post once the mod is approved", async () => {
    fakeThread("thread-42", { archived: true, appliedTags: ["tag-suggested"] });

    await announceReview(fakeMod({ status: "approved" }), "approved");

    expect(state.calls.map(([name]) => name)).toEqual([
      "edit",
      "send",
      "setArchived",
    ]);
    expect(state.calls[0][1]).toEqual({
      archived: false,
      appliedTags: ["tag-approved"],
      reason: "Workshop suggestion #42: Approved",
    });
    expect(state.calls[1][1]).toMatchObject({
      content: expect.stringContaining("Approved"),
    });
    expect(state.calls[2][1]).toEqual({
      archived: true,
      reason: "Workshop suggestion #42: Approved",
    });
  });

  it("unarchives in the same request as the retag even when the cache says the post is open", async () => {
    fakeThread("thread-42", { archived: false });

    await announceReview(fakeMod({ status: "testing" }), "testing");

    expect(state.calls[0]).toEqual([
      "edit",
      expect.objectContaining({
        archived: false,
        appliedTags: ["tag-testing"],
      }),
    ]);
  });

  it("keeps unmanaged tags and swaps the managed one", async () => {
    fakeThread("thread-42", {
      appliedTags: ["tag-next-update", "tag-custom"],
    });

    await announceReview(fakeMod({ status: "in_pack" }), "in_pack");

    expect(state.calls[0][1]).toMatchObject({
      appliedTags: ["tag-in-pack", "tag-custom"],
    });
  });

  it("tags rejected posts with the reason and closes them", async () => {
    fakeThread("thread-42", { appliedTags: ["tag-suggested"] });

    await announceReview(
      fakeMod({
        status: "rejected",
        rejectReason: "incompatible",
        rejectNote: "Crashes on load",
      }),
      "rejected",
    );

    expect(state.calls.map(([name]) => name)).toEqual([
      "edit",
      "send",
      "setArchived",
    ]);
    expect(state.calls[0][1]).toMatchObject({
      archived: false,
      appliedTags: ["tag-incompatible"],
    });
    expect(state.calls[1][1]).toMatchObject({
      content: expect.stringContaining("Crashes on load"),
    });
    expect(state.calls[2][1]).toEqual({
      archived: true,
      reason: "Workshop suggestion #42: Ruled out",
    });
  });

  it("sheds the managed tag when a rejection carries no reason", async () => {
    fakeThread("thread-42", {
      archived: true,
      appliedTags: ["tag-next-update", "tag-custom"],
    });

    await announceReview(fakeMod({ status: "rejected" }), "rejected");

    expect(state.calls.map(([name]) => name)).toEqual([
      "edit",
      "send",
      "setArchived",
    ]);
    expect(state.calls[0][1]).toMatchObject({
      archived: false,
      appliedTags: ["tag-custom"],
    });
    expect(state.calls[1][1]).toMatchObject({
      content: "🚫 **Rejected.**",
    });
  });

  it("closes a drop-out with its own audit reason", async () => {
    fakeThread("thread-42", { archived: true, appliedTags: ["tag-in-pack"] });

    await announcePackDropOut(fakeMod({ status: "next_update" }));

    expect(state.calls[0][1]).toMatchObject({
      appliedTags: ["tag-next-update"],
      reason: "Workshop suggestion #42: dropped from the pack update",
    });
    expect(state.calls[1][1]).toMatchObject({
      content: expect.stringContaining("Dropped from the latest pack update"),
    });
    expect(state.calls[2][1]).toEqual({
      archived: true,
      reason: "Workshop suggestion #42: dropped from the pack update",
    });
  });

  it("logs a failed close on its own without disturbing the posted outcome", async () => {
    const thread = fakeThread("thread-42");
    thread.setArchived.mockRejectedValueOnce(new Error("Missing Permissions"));
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

    await expect(
      announceReview(fakeMod({ status: "approved" }), "approved"),
    ).resolves.toBeUndefined();

    expect(state.calls.map(([name]) => name)).toEqual(["edit", "send"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not close thread for mod #42"),
    );
    warn.mockRestore();
  });
});

describe("healThreads", () => {
  it("re-closes posts that were reopened after the mod left review", async () => {
    const reopened = fakeThread("thread-1", { archived: false });
    const pending = fakeThread("thread-2", { archived: false });
    const closed = fakeThread("thread-3", { archived: true });
    const rejected = fakeThread("thread-4", { archived: false });

    await healThreads({ id: 1, status: "closed" } as Workshop, [
      fakeMod({ id: 1, discordThreadId: "thread-1", status: "in_pack" }),
      fakeMod({ id: 2, discordThreadId: "thread-2", status: "pending" }),
      fakeMod({ id: 3, discordThreadId: "thread-3", status: "approved" }),
      fakeMod({ id: 4, discordThreadId: "thread-4", status: "rejected" }),
    ]);

    expect(reopened.setArchived).toHaveBeenCalledWith(
      true,
      "Workshop suggestion #1: In the pack",
    );
    expect(rejected.setArchived).toHaveBeenCalledWith(
      true,
      "Workshop suggestion #4: Ruled out",
    );
    expect(pending.setArchived).not.toHaveBeenCalled();
    expect(closed.setArchived).not.toHaveBeenCalled();
  });
});
