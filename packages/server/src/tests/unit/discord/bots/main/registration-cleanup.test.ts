import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ChannelType, OverwriteType, type Client } from "discord.js";

const { lookupMember } = vi.hoisted(() => ({ lookupMember: vi.fn() }));

vi.mock("@/services/waitlist/discord-lookup", () => ({ lookupMember }));

vi.mock("@/config", () => ({
  default: { discord: { guild: { id: "guild" } } },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Categories: { VERIFICATION: "verification" },
    Roles: { VERIFIED: "verified" },
  },
}));

vi.mock("@/discord/components/presets/registration", () => ({
  RegistrationComponentPresets: {
    closing: () => ({ components: [], flags: 0 }),
  },
}));

import {
  CLOSE_GRACE_MS,
  sweepRegistrationChannels,
} from "@/discord/bots/main/registration-cleanup";

function verificationChannel(memberId: string) {
  return {
    id: `verify-${memberId}`,
    parentId: "verification",
    type: ChannelType.GuildText,
    permissionOverwrites: {
      cache: [{ id: memberId, type: OverwriteType.Member }],
    },
    send: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

function botWith(channels: ReturnType<typeof verificationChannel>[]): Client {
  const cache = new Map(channels.map((channel) => [channel.id, channel]));
  const collection = Object.assign(cache, {
    filter: (keep: (channel: (typeof channels)[number]) => boolean) =>
      new Map([...cache].filter(([, channel]) => keep(channel))),
  });
  return {
    guilds: {
      cache: new Map([["guild", { channels: { cache: collection } }]]),
    },
  } as unknown as Client;
}

function member(verified: boolean) {
  return {
    user: { tag: "someone" },
    roles: { cache: { has: () => verified } },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  lookupMember.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sweepRegistrationChannels", () => {
  it("deletes the channel of a member Discord reports gone", async () => {
    const channel = verificationChannel("1");
    lookupMember.mockResolvedValue({ state: "gone" });

    await sweepRegistrationChannels(botWith([channel]));
    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);

    expect(channel.delete).toHaveBeenCalledTimes(1);
  });

  it("keeps the channel when the member lookup fails", async () => {
    const channel = verificationChannel("1");
    lookupMember.mockResolvedValue({ state: "unavailable" });

    await sweepRegistrationChannels(botWith([channel]));
    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);

    expect(channel.send).not.toHaveBeenCalled();
    expect(channel.delete).not.toHaveBeenCalled();
  });

  it("keeps the channel of a member who has not registered yet and closes a verified one", async () => {
    const waiting = verificationChannel("1");
    const done = verificationChannel("2");
    lookupMember.mockImplementation(async (id: string) => ({
      state: "found",
      member: member(id === "2"),
    }));

    await sweepRegistrationChannels(botWith([waiting, done]));
    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);

    expect(waiting.delete).not.toHaveBeenCalled();
    expect(done.delete).toHaveBeenCalledTimes(1);
  });
});
