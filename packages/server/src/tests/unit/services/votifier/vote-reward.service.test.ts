import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import EventEmitter from "node:events";

const mocks = vi.hoisted(() => ({
  getPending: vi.fn(),
  getPendingPlayerUuids: vi.fn(),
  updateVote: vi.fn(),
  findPlayers: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: true },
    redis: { url: null },
  },
}));
vi.mock("@/db", () => ({
  Q: {
    player: {
      findAll: mocks.findPlayers,
      vote: {
        getPending: mocks.getPending,
        getPendingPlayerUuids: mocks.getPendingPlayerUuids,
        update: mocks.updateVote,
      },
    },
  },
}));

import { VoteRewardService } from "@/services/votifier/vote-reward.service";
import type { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
import type { PlayerVote } from "@createrington/shared/db";

const ALICE = "aaaa0000-0000-4000-8000-000000000041";
const SERVER = 1;

function vote(
  id: number,
  votedAt: string,
  serviceName = "createmodservers.com",
): PlayerVote {
  return {
    id,
    playerMinecraftUuid: ALICE,
    username: "Alice",
    serviceName,
    votedAt: new Date(votedAt),
    receivedAt: new Date(votedAt),
    rewardedAt: null,
    rewardError: null,
  };
}

function okReply(command: string): string {
  if (command.startsWith("give")) return "Gave 1 [Bill] to Alice";
  if (command.startsWith("xp")) return "Gave 500 experience points to Alice";
  return "";
}

let playtime: EventEmitter;
let send: ReturnType<
  typeof vi.fn<(serverId: number, command: string) => Promise<string>>
>;
let service: VoteRewardService;

beforeEach(async () => {
  vi.clearAllMocks();
  playtime = new EventEmitter();
  send = vi.fn(async (_serverId: number, command: string) => okReply(command));
  mocks.updateVote.mockResolvedValue(undefined);
  mocks.getPendingPlayerUuids.mockResolvedValue([]);
  const manager = {
    getAllServices: () => new Map([[SERVER, playtime]]),
  } as unknown as PlaytimeManagerService;
  service = new VoteRewardService(manager, send, { sweepIntervalMs: 60_000 });
  await service.initialize();
});

afterEach(async () => {
  await service.shutdown();
});

function updatedWith(id: number) {
  return mocks.updateVote.mock.calls
    .filter(([identifier]) => identifier.id === id)
    .map(([, data]) => data);
}

describe("VoteRewardService.payout", () => {
  it("gives the bill and the xp per vote, thanks once, and stamps each vote", async () => {
    mocks.getPending.mockResolvedValue([
      vote(1, "2026-10-01T10:00:00Z"),
      vote(2, "2026-10-02T10:00:00Z"),
    ]);

    await service.payout(ALICE, "Alice", SERVER);

    expect(send.mock.calls.map(([, command]) => command)).toEqual([
      "give Alice createringtoncurrency:bill_10 1",
      "xp add Alice 500 points",
      "give Alice createringtoncurrency:bill_10 1",
      "xp add Alice 500 points",
      'tellraw Alice {"text":"Thanks for voting 2 times! Your rewards are in your inventory.","color":"gold"}',
    ]);
    expect(send.mock.calls.every(([serverId]) => serverId === SERVER)).toBe(
      true,
    );
    expect(updatedWith(1)).toEqual([
      { rewardedAt: expect.any(Date), rewardError: null },
    ]);
    expect(updatedWith(2)).toEqual([
      { rewardedAt: expect.any(Date), rewardError: null },
    ]);
  });

  it("does nothing when the player has no pending votes", async () => {
    mocks.getPending.mockResolvedValue([]);

    await service.payout(ALICE, "Alice", SERVER);

    expect(send).not.toHaveBeenCalled();
    expect(mocks.updateVote).not.toHaveBeenCalled();
  });

  it("keeps the vote pending with the error and stops when a command fails", async () => {
    mocks.getPending.mockResolvedValue([
      vote(1, "2026-10-01T10:00:00Z"),
      vote(2, "2026-10-02T10:00:00Z"),
    ]);
    send.mockResolvedValueOnce("No player was found");

    await service.payout(ALICE, "Alice", SERVER);

    expect(send).toHaveBeenCalledTimes(1);
    expect(updatedWith(1)).toEqual([
      {
        rewardError:
          "give Alice createringtoncurrency:bill_10 1: No player was found",
      },
    ]);
    expect(updatedWith(2)).toEqual([]);
  });

  it("keeps the vote pending when RCON is unreachable", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    send.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await service.payout(ALICE, "Alice", SERVER);

    expect(updatedWith(1)).toEqual([
      {
        rewardError:
          "give Alice createringtoncurrency:bill_10 1: connect ECONNREFUSED",
      },
    ]);
  });

  it("still stamps the votes when only the thank-you fails", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    send.mockImplementation(async (_serverId, command) => {
      if (command.startsWith("tellraw")) throw new Error("gone");
      return okReply(command);
    });

    await service.payout(ALICE, "Alice", SERVER);

    expect(updatedWith(1)).toEqual([
      { rewardedAt: expect.any(Date), rewardError: null },
    ]);
  });

  it("does not run two payouts for the same player at once", async () => {
    let release!: () => void;
    const gate = new Promise<PlayerVote[]>((resolve) => {
      release = () => resolve([vote(1, "2026-10-01T10:00:00Z")]);
    });
    mocks.getPending.mockReturnValueOnce(gate).mockResolvedValue([]);

    const first = service.payout(ALICE, "Alice", SERVER);
    const second = service.payout(ALICE, "Alice", SERVER);
    release();
    await Promise.all([first, second]);

    expect(mocks.getPending).toHaveBeenCalledTimes(1);
    expect(
      send.mock.calls.filter(([, c]) => c.startsWith("give")),
    ).toHaveLength(1);
  });
  it("stamps the vote once the bill is given, so a failed xp never repeats the bill", async () => {
    mocks.getPending
      .mockResolvedValueOnce([
        vote(1, "2026-10-01T10:00:00Z"),
        vote(2, "2026-10-02T10:00:00Z"),
      ])
      .mockResolvedValue([vote(2, "2026-10-02T10:00:00Z")]);
    send.mockImplementationOnce(async (_s, c) => okReply(c));
    send.mockImplementationOnce(async () => "No player was found");

    await service.payout(ALICE, "Alice", SERVER);

    expect(updatedWith(1)).toEqual([
      { rewardedAt: expect.any(Date), rewardError: null },
      { rewardError: "xp add Alice 500 points: No player was found" },
    ]);
    expect(updatedWith(2)).toEqual([]);

    await service.payout(ALICE, "Alice", SERVER);

    const gives = send.mock.calls.filter(([, c]) => c.startsWith("give"));
    expect(gives).toHaveLength(2);
    expect(updatedWith(1)).toHaveLength(2);
    expect(updatedWith(2)).toEqual([
      { rewardedAt: expect.any(Date), rewardError: null },
    ]);
  });
});

describe("VoteRewardService on a session start", () => {
  it("pays the joining player on the server they joined", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    playtime.emit("sessionStart", {
      uuid: ALICE,
      username: "Alice",
      serverId: SERVER,
      sessionStart: new Date(),
    });
    await vi.waitFor(() => expect(updatedWith(1)).toHaveLength(1));

    expect(send).toHaveBeenCalledWith(
      SERVER,
      "give Alice createringtoncurrency:bill_10 1",
    );
  });
});

describe("VoteRewardService.sweep", () => {
  it("pays online players with pending votes on their current server", async () => {
    mocks.getPendingPlayerUuids.mockResolvedValue([ALICE, "offline-uuid"]);
    mocks.findPlayers.mockResolvedValue([
      {
        minecraftUuid: ALICE,
        minecraftUsername: "Alice",
        online: true,
        currentServerId: 7,
      },
    ]);
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    await service.sweep();

    expect(mocks.findPlayers).toHaveBeenCalledWith({
      minecraftUuid: { $in: [ALICE, "offline-uuid"] },
      online: true,
    });
    expect(send).toHaveBeenCalledWith(
      7,
      "give Alice createringtoncurrency:bill_10 1",
    );
  });

  it("logs and survives a failing query", async () => {
    mocks.getPendingPlayerUuids.mockRejectedValue(new Error("pool exhausted"));

    await expect(service.sweep()).resolves.toBeUndefined();

    expect(mocks.findPlayers).not.toHaveBeenCalled();
  });

  it("does not query players when nothing is pending", async () => {
    mocks.getPendingPlayerUuids.mockResolvedValue([]);

    await service.sweep();

    expect(mocks.findPlayers).not.toHaveBeenCalled();
  });
});
