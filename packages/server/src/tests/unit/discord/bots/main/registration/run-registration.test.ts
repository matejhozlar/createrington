import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GuildMember } from "discord.js";

const mocks = vi.hoisted(() => ({
  players: new Set<string>(),
  whitelist: vi.fn(),
  failSave: false,
  releaseReservation: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      exists: async (filter: { discordId?: string; minecraftUuid?: string }) =>
        filter.discordId ? mocks.players.has(filter.discordId) : false,
    },
    waitlist: { entry: { find: async () => null } },
  },
  db: {
    inTransaction: async (
      fn: (tx: unknown) => Promise<void>,
    ): Promise<void> => {
      if (mocks.failSave) throw new Error("duplicate key");
      const tx = {
        player: {
          create: async ({ discordId }: { discordId: string }) => {
            mocks.players.add(discordId);
          },
          balance: { create: async () => {} },
          vote: { linkUsername: async () => {} },
        },
        waitlist: { entry: { update: async () => {} } },
      };
      await fn(tx);
    },
  },
}));

vi.mock("@/services/waitlist/progress-embed", () => ({
  updateProgressEmbed: async () => {},
}));

vi.mock("@/services/waitlist/waitlist.service", () => ({
  waitlistService: {
    reserveForDirectRegistration: async () => ({
      entry: { id: 1 },
      reserved: true,
    }),
    releaseReservation: mocks.releaseReservation,
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Roles: {
      UNVERIFIED: "role-unverified",
      VERIFIED: "role-verified",
      ADMIN: "role-admin",
    },
    Channels: { administration: { NOTIFICATIONS: "notifications-1" } },
    Messages: { send: async () => ({ id: "message-1" }) },
  },
}));

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    registration: { adminError: () => ({ build: () => ({}) }) },
  },
}));

vi.mock("@/discord/components/presets/registration", () => ({
  RegistrationComponentPresets: {
    error: () => ({}),
    progress: () => ({}),
    idle: () => ({}),
    success: () => ({}),
  },
}));

vi.mock("@/discord/bots/main/registration-cleanup", () => ({
  AUTO_CLOSE_MS: 1000,
  scheduleChannelClose: () => {},
}));

vi.mock("@/discord/utils/roles/role-manager", () => ({
  RoleManager: {
    has: () => true,
    remove: async () => true,
    assign: async () => true,
  },
}));

vi.mock("@/utils/rcon", () => ({
  minecraftRcon: { whitelistAll: mocks.whitelist },
  WhitelistAction: { ADD: "add", REMOVE: "remove" },
}));

vi.mock("@/services/skin-api/client", () => ({
  getSkinApiClient: () => ({
    resolve: async ({ username }: { username: string }) => ({
      uuid: `uuid-${username}`,
      username,
    }),
  }),
}));

vi.mock("createrington-skin-api", () => ({
  SkinApiError: class extends Error {
    status = 0;
  },
}));

vi.mock("@/discord/bots/main/registration/post-welcome-card", () => ({
  postRegistrationWelcomeCard: async () => {},
}));

vi.mock("@/discord/bots/main/registration/verification-channel", () => ({
  isVerificationChannel: () => false,
}));

import { runRegistration } from "@/discord/bots/main/registration/run-registration";

function register(mcName: string, discordId = "member-1") {
  return runRegistration({
    member: { setNickname: async () => {} } as unknown as GuildMember,
    discordId,
    userTag: "member#0001",
    username: "member",
    mcName,
    channel: null,
    render: async () => {},
  });
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

const whitelistCalls = () =>
  mocks.whitelist.mock.calls.map(([action, name]) => `${action} ${name}`);

describe("runRegistration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.players.clear();
    mocks.whitelist.mockReset().mockResolvedValue(new Map());
    mocks.failSave = false;
    mocks.releaseReservation.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes the name from the whitelist when saving the player fails", async () => {
    mocks.failSave = true;

    const result = await settle(register("Alt"));

    expect(result.ok).toBe(false);
    expect(whitelistCalls()).toEqual(["add Alt", "remove Alt"]);
    expect(mocks.releaseReservation).toHaveBeenCalledWith(1);
  });

  it("removes the name when the whitelist add fails on one of the servers", async () => {
    mocks.whitelist
      .mockRejectedValueOnce(new Error("server 2 unreachable"))
      .mockResolvedValue(new Map());

    const result = await settle(register("Alt"));

    expect(result.ok).toBe(false);
    expect(whitelistCalls()).toEqual(["add Alt", "remove Alt"]);
  });

  it("keeps the whitelist entry of a registration that saved", async () => {
    const result = await settle(register("Main"));

    expect(result.ok).toBe(true);
    expect(whitelistCalls()).toEqual(["add Main"]);
  });

  it("refuses a Discord account that already has a player before whitelisting anything", async () => {
    mocks.players.add("member-1");

    const result = await settle(register("Alt"));

    expect(result.ok).toBe(false);
    expect(mocks.whitelist).not.toHaveBeenCalled();
  });

  it("whitelists only one name when one member runs two registrations at once", async () => {
    const results = await settle(
      Promise.all([register("Alt"), register("Main")]),
    );

    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(whitelistCalls()).toEqual(["add Alt"]);
  });
});
