import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

type Entry = {
  id: number;
  discordId: string;
  discordUsername: string;
  status: "queued" | "promoted" | "registered" | "expired";
  queuedAt: Date;
  promotedAt: Date | null;
  promotedBy: string | null;
  registeredAt: Date | null;
  expiredAt: Date | null;
  joinedMinecraft: boolean;
  verifyChannelId: string | null;
  waitingMessageId: string | null;
  adminMessageId: string | null;
};

const state = vi.hoisted(() => {
  class ConstraintViolationError extends Error {}
  return {
    ConstraintViolationError,
    entries: [] as Entry[],
    nextId: 1,
    free: 0,
    freeDelayMs: 0,
    findAllCalls: 0,
    guildAvailable: true,
    memberFetch: vi.fn(),
    channelFetch: vi.fn(),
    adminSend: vi.fn(),
    progressEmbed: vi.fn(),
  };
});

function fakeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: state.nextId++,
    discordId: `user-${state.nextId}`,
    discordUsername: `user${state.nextId}`,
    status: "queued",
    queuedAt: new Date(Date.now() - state.nextId * 1000),
    promotedAt: null,
    promotedBy: null,
    registeredAt: null,
    expiredAt: null,
    joinedMinecraft: false,
    verifyChannelId: "channel-1",
    waitingMessageId: "waiting-1",
    adminMessageId: null,
    ...overrides,
  };
}

vi.mock("@/db/utils/errors", () => ({
  ConstraintViolationError: state.ConstraintViolationError,
}));

vi.mock("@/db", () => {
  const locate = (identifier: { id?: number; discordId?: string }) =>
    state.entries.find((e) =>
      identifier.id !== undefined
        ? e.id === identifier.id
        : e.discordId === identifier.discordId,
    );

  const entry = {
    find: async (identifier: { id?: number; discordId?: string }) =>
      locate(identifier) ?? null,
    get: async (identifier: { id?: number; discordId?: string }) => {
      const found = locate(identifier);
      if (!found) throw new Error("not found");
      return found;
    },
    findAll: async (
      filters: { status: Entry["status"] },
      options: { limit: number },
    ) => {
      state.findAllCalls++;
      return state.entries
        .filter((e) => e.status === filters.status)
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())
        .slice(0, options.limit);
    },
    count: async (filters: { status: Entry["status"] }) =>
      state.entries.filter((e) => e.status === filters.status).length,
    update: async (identifier: { id: number }, data: Partial<Entry>) => {
      const found = locate(identifier);
      if (!found) throw new Error("not found");
      if (data.status === "promoted" && found.status !== "promoted") {
        state.free--;
      }
      Object.assign(found, data);
      return found;
    },
    createAndReturn: async (data: Partial<Entry>) => {
      if (state.entries.some((e) => e.discordId === data.discordId)) {
        throw new state.ConstraintViolationError("duplicate key");
      }
      const created = fakeEntry(data);
      state.entries.push(created);
      if (created.status === "promoted") state.free--;
      return created;
    },
  };

  return {
    Q: {
      waitlist: { entry },
      player: { exists: async () => false },
      discord: { guild: { member: { join: { recordJoin: async () => 1 } } } },
    },
    waitlistRepo: {
      getFreeSlots: async () => {
        if (state.freeDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, state.freeDelayMs),
          );
        }
        return state.free;
      },
      updateProgressEmbed: state.progressEmbed,
    },
  };
});

vi.mock("@/config", () => ({
  default: { discord: { guild: { id: "guild-1" } } },
}));

vi.mock("@/discord/bots/main/client", () => ({
  mainBot: {
    guilds: {
      cache: {
        get: () =>
          state.guildAvailable
            ? { members: { fetch: state.memberFetch } }
            : undefined,
      },
    },
    channels: { fetch: state.channelFetch },
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "notifications" } },
    Messages: { send: state.adminSend },
  },
}));
vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    waitlist: {
      queueNotification: () => ({
        embed: {
          setTimestamp() {
            return this;
          },
        },
        components: [],
      }),
    },
  },
}));
vi.mock("@/discord/components/presets/registration", () => ({
  RegistrationComponentPresets: { idle: () => ({ components: [], flags: 0 }) },
}));
vi.mock("@/discord/components/presets/waitlist", () => ({
  WaitlistComponentPresets: { waiting: () => ({ components: [], flags: 0 }) },
}));
vi.mock("@/discord/bots/main/registration/verification-channel", () => ({
  createVerificationChannel: vi.fn(),
}));
vi.mock("@/app/middleware/error-handler", () => ({
  BadRequestError: class BadRequestError extends Error {},
}));

import { WaitlistService } from "@/services/waitlist/waitlist.service";

function unknownMember(): DiscordAPIError {
  return new DiscordAPIError(
    { code: RESTJSONErrorCodes.UnknownMember, message: "Unknown Member" },
    RESTJSONErrorCodes.UnknownMember,
    404,
    "GET",
    "https://discord.com/api/v10/guilds/guild-1/members/x",
    {},
  );
}

beforeEach(() => {
  state.entries = [];
  state.nextId = 1;
  state.free = 0;
  state.freeDelayMs = 0;
  state.findAllCalls = 0;
  state.guildAvailable = true;
  state.memberFetch.mockReset();
  state.memberFetch.mockImplementation(async (id: string) => ({
    id,
    toString: () => `<@${id}>`,
  }));
  state.channelFetch.mockReset();
  state.channelFetch.mockImplementation(async () => ({
    isTextBased: () => true,
    isDMBased: () => false,
    messages: { fetch: async () => ({ edit: async () => undefined }) },
    send: async () => ({ id: "sent-1" }),
  }));
  state.adminSend.mockReset();
  state.adminSend.mockResolvedValue({ success: true, messageId: "admin-1" });
  state.progressEmbed.mockReset();
  state.progressEmbed.mockResolvedValue(undefined);
});

describe("WaitlistService.promoteEligible", () => {
  it("promotes the oldest queued entries and stops when the slots run out", async () => {
    state.free = 2;
    const first = fakeEntry({ queuedAt: new Date(1_000) });
    const second = fakeEntry({ queuedAt: new Date(2_000) });
    const third = fakeEntry({ queuedAt: new Date(3_000) });
    state.entries.push(third, first, second);

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(2);

    expect(first.status).toBe("promoted");
    expect(second.status).toBe("promoted");
    expect(third.status).toBe("queued");
  });

  it("coalesces concurrent calls into one pass plus a single follow-up", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    state.entries.push(fakeEntry({}));

    const svc = new WaitlistService();
    const a = svc.promoteEligible();
    const b = svc.promoteEligible();
    const c = svc.promoteEligible();

    expect(await Promise.all([a, b, c])).toEqual([1, 1, 1]);
    expect(state.findAllCalls).toBe(1);

    state.free = 0;
    await svc.promoteEligible();
    expect(state.findAllCalls).toBe(1);
  });

  it("does nothing while the guild is not in the bot cache", async () => {
    state.free = 5;
    state.guildAvailable = false;
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("queued");
    expect(state.memberFetch).not.toHaveBeenCalled();
  });

  it("skips, rather than expires, entries whose member lookup fails transiently", async () => {
    state.free = 5;
    state.memberFetch.mockRejectedValue(new Error("503 Service Unavailable"));
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("queued");
  });

  it("expires entries only when Discord reports the member gone", async () => {
    state.free = 5;
    state.memberFetch.mockRejectedValue(unknownMember());
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("expired");
    expect(entry.expiredAt).toBeInstanceOf(Date);
  });

  it("runs a follow-up pass when a full batch still leaves free slots", async () => {
    state.free = 150;
    for (let i = 0; i < 120; i++) {
      state.entries.push(fakeEntry({ queuedAt: new Date(i * 1_000) }));
    }

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(120);
    expect(state.findAllCalls).toBe(2);
    expect(state.entries.every((e) => e.status === "promoted")).toBe(true);
  });

  it("alerts admins when a promoted member could not be pinged", async () => {
    state.free = 1;
    state.channelFetch.mockRejectedValue(new Error("502 Bad Gateway"));
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistService();
    expect(await svc.promoteEligible()).toBe(1);
    expect(entry.status).toBe("promoted");
    expect(state.adminSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "notifications",
        content: expect.stringContaining(`#${entry.id}`),
      }),
    );
  });
});

describe("WaitlistService.reserveForDirectRegistration", () => {
  it("returns null without writing when no slot is free", async () => {
    state.free = 0;
    const svc = new WaitlistService();
    expect(await svc.reserveForDirectRegistration("u1", "user1")).toBeNull();
    expect(state.entries).toHaveLength(0);
  });

  it("creates a promoted entry and notifies admins when a slot is free", async () => {
    state.free = 1;
    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration("u1", "user1");

    expect(result?.reserved).toBe(true);
    expect(result?.entry.status).toBe("promoted");
    expect(state.free).toBe(0);
    expect(state.adminSend).toHaveBeenCalledTimes(1);
  });

  it("reports reserved=false for a member who already holds a promotion", async () => {
    state.free = 0;
    const entry = fakeEntry({ discordId: "u1", status: "promoted" });
    state.entries.push(entry);

    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration("u1", "user1");
    expect(result).toEqual({ entry, reserved: false });
  });

  it("flips an expired entry back to promoted instead of creating a duplicate", async () => {
    state.free = 1;
    const entry = fakeEntry({
      discordId: "u1",
      status: "expired",
      expiredAt: new Date(),
    });
    state.entries.push(entry);

    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration("u1", "user1");

    expect(result?.reserved).toBe(true);
    expect(state.entries).toHaveLength(1);
    expect(entry.status).toBe("promoted");
    expect(entry.expiredAt).toBeNull();
    expect(state.progressEmbed).toHaveBeenCalledWith(entry.id);
  });

  it("lets only one of two simultaneous registrations take the last slot", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    const svc = new WaitlistService();

    const [a, b] = await Promise.all([
      svc.reserveForDirectRegistration("u1", "user1"),
      svc.reserveForDirectRegistration("u2", "user2"),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.free).toBe(0);
  });

  it("serializes against the promotion pass so the pass and a direct registration cannot share a slot", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    const queued = fakeEntry({ discordId: "queued-1" });
    state.entries.push(queued);

    const svc = new WaitlistService();
    const [promoted, reservation] = await Promise.all([
      svc.promoteEligible(),
      svc.reserveForDirectRegistration("direct-1", "direct"),
    ]);

    const promotedCount = state.entries.filter(
      (e) => e.status === "promoted",
    ).length;
    expect(promotedCount).toBe(1);
    expect(promoted + (reservation ? 1 : 0)).toBe(1);
    expect(state.free).toBe(0);
  });
});
