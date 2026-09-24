import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayRateLimitError, type Guild } from "discord.js";
import {
  loadAllGuildMembers,
  resetGuildMemberFetchCache,
} from "@/discord/utils/guild-members";

function fakeGuild(fetch: () => Promise<unknown>, id = "guild-1"): Guild {
  return { id, members: { fetch: vi.fn(fetch) } } as unknown as Guild;
}

function fetchMock(guild: Guild) {
  return guild.members.fetch as unknown as ReturnType<typeof vi.fn>;
}

function rateLimited(retryAfter: number): GatewayRateLimitError {
  return new GatewayRateLimitError(
    { opcode: 8, retry_after: retryAfter, meta: { guild_id: "guild-1" } },
    { query: "", limit: 0 },
  );
}

describe("loadAllGuildMembers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetGuildMemberFetchCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the guild after fetching its members", async () => {
    const guild = fakeGuild(async () => undefined);

    await expect(loadAllGuildMembers(guild)).resolves.toBe(guild);
    expect(fetchMock(guild)).toHaveBeenCalledTimes(1);
  });

  it("shares one request between concurrent callers", async () => {
    const guild = fakeGuild(async () => undefined);

    await Promise.all([
      loadAllGuildMembers(guild),
      loadAllGuildMembers(guild),
      loadAllGuildMembers(guild),
    ]);

    expect(fetchMock(guild)).toHaveBeenCalledTimes(1);
  });

  it("reuses a fetch completed within the last 30 seconds", async () => {
    const guild = fakeGuild(async () => undefined);

    await loadAllGuildMembers(guild);
    vi.advanceTimersByTime(29_000);
    await loadAllGuildMembers(guild);

    expect(fetchMock(guild)).toHaveBeenCalledTimes(1);
  });

  it("fetches again once the window has passed", async () => {
    const guild = fakeGuild(async () => undefined);

    await loadAllGuildMembers(guild);
    vi.advanceTimersByTime(30_000);
    await loadAllGuildMembers(guild);

    expect(fetchMock(guild)).toHaveBeenCalledTimes(2);
  });

  it("tracks each guild separately", async () => {
    const first = fakeGuild(async () => undefined, "guild-1");
    const second = fakeGuild(async () => undefined, "guild-2");

    await loadAllGuildMembers(first);
    await loadAllGuildMembers(second);

    expect(fetchMock(first)).toHaveBeenCalledTimes(1);
    expect(fetchMock(second)).toHaveBeenCalledTimes(1);
  });

  it("waits retry_after and retries once when rate limited", async () => {
    const guild = fakeGuild(async () => undefined);
    fetchMock(guild).mockRejectedValueOnce(rateLimited(17.42));

    const pending = loadAllGuildMembers(guild);
    await vi.advanceTimersByTimeAsync(17_419);
    expect(fetchMock(guild)).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(guild);
    expect(fetchMock(guild)).toHaveBeenCalledTimes(2);
  });

  it("throws when the retry is rate limited too", async () => {
    const guild = fakeGuild(async () => {
      throw rateLimited(1);
    });

    const pending = loadAllGuildMembers(guild);
    const assertion = expect(pending).rejects.toBeInstanceOf(
      GatewayRateLimitError,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(fetchMock(guild)).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors", async () => {
    const guild = fakeGuild(async () => {
      throw new Error("GuildMembersTimeout");
    });

    await expect(loadAllGuildMembers(guild)).rejects.toThrow(
      "GuildMembersTimeout",
    );
    expect(fetchMock(guild)).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed fetch", async () => {
    const guild = fakeGuild(async () => undefined);
    fetchMock(guild).mockRejectedValueOnce(new Error("boom"));

    await expect(loadAllGuildMembers(guild)).rejects.toThrow("boom");
    await loadAllGuildMembers(guild);

    expect(fetchMock(guild)).toHaveBeenCalledTimes(2);
  });
});
