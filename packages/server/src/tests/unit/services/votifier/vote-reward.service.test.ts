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
import type {
  PlaytimeManagerService,
  ServiceListener,
} from "@/services/playtime/playtime-manager.service";
import type { PlayerVote } from "@createrington/shared/db";

const ALICE = "aaaa0000-0000-4000-8000-000000000041";
const SERVER = 1;
const TEST_SERVER = 2;
const GIVE = "give Alice createringtoncurrency:bill_10 1";
const XP = "xp add Alice 500 points";

function vote(id: number, votedAt: string): PlayerVote {
  return {
    id,
    playerMinecraftUuid: ALICE,
    username: "Alice",
    serviceName: "createmodservers.com",
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

function sessionStart(serverId: number) {
  return {
    uuid: ALICE,
    username: "Alice",
    serverId,
    sessionStart: new Date(),
  };
}

const STAMPED = { rewardedAt: expect.any(Date), rewardError: null };

let playtime: EventEmitter;
let testPlaytime: EventEmitter;
let listeners: ServiceListener[];
let send: ReturnType<
  typeof vi.fn<(serverId: number, command: string) => Promise<string>>
>;
let service: VoteRewardService;

beforeEach(async () => {
  vi.clearAllMocks();
  playtime = new EventEmitter();
  testPlaytime = new EventEmitter();
  listeners = [];
  send = vi.fn(async (_serverId: number, command: string) => okReply(command));
  mocks.updateVote.mockResolvedValue(undefined);
  mocks.getPendingPlayerUuids.mockResolvedValue([]);
  const manager = {
    onServiceCreated: (listener: ServiceListener) => {
      listeners.push(listener);
      listener(SERVER, playtime as never);
      listener(TEST_SERVER, testPlaytime as never);
    },
  } as unknown as PlaytimeManagerService;
  service = new VoteRewardService(manager, send, {
    rewardServerIds: [SERVER],
    sweepIntervalMs: 60_000,
  });
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

function gives() {
  return send.mock.calls.filter(([, command]) => command === GIVE);
}

describe("VoteRewardService.payout", () => {
  it("claims each vote, gives the bill and the xp, and thanks once", async () => {
    mocks.getPending.mockResolvedValue([
      vote(1, "2026-10-01T10:00:00Z"),
      vote(2, "2026-10-02T10:00:00Z"),
    ]);

    await service.payout(ALICE, "Alice", SERVER);

    expect(send.mock.calls.map(([, command]) => command)).toEqual([
      GIVE,
      XP,
      GIVE,
      XP,
      'tellraw Alice {"text":"Thanks for voting 2 times! Your rewards are in your inventory.","color":"gold"}',
    ]);
    expect(send.mock.calls.every(([serverId]) => serverId === SERVER)).toBe(
      true,
    );
    expect(updatedWith(1)).toEqual([STAMPED]);
    expect(updatedWith(2)).toEqual([STAMPED]);
  });

  it("claims the vote before giving the bill", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    const order: string[] = [];
    mocks.updateVote.mockImplementation(async () => {
      order.push("stamp");
    });
    send.mockImplementation(async (_serverId, command) => {
      order.push(command);
      return okReply(command);
    });

    await service.payout(ALICE, "Alice", SERVER);

    expect(order.slice(0, 2)).toEqual(["stamp", GIVE]);
  });

  it("does nothing when the player has no pending votes", async () => {
    mocks.getPending.mockResolvedValue([]);

    await service.payout(ALICE, "Alice", SERVER);

    expect(send).not.toHaveBeenCalled();
    expect(mocks.updateVote).not.toHaveBeenCalled();
  });

  it("reverts the claim, keeps the error and stops when the bill fails", async () => {
    mocks.getPending.mockResolvedValue([
      vote(1, "2026-10-01T10:00:00Z"),
      vote(2, "2026-10-02T10:00:00Z"),
    ]);
    send.mockResolvedValueOnce("No player was found");

    await service.payout(ALICE, "Alice", SERVER);

    expect(send).toHaveBeenCalledTimes(1);
    expect(updatedWith(1)).toEqual([
      STAMPED,
      { rewardedAt: null, rewardError: `${GIVE}: No player was found` },
    ]);
    expect(updatedWith(2)).toEqual([]);
  });

  it("reverts the claim when RCON is unreachable", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    send.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await service.payout(ALICE, "Alice", SERVER);

    expect(updatedWith(1)).toEqual([
      STAMPED,
      { rewardedAt: null, rewardError: `${GIVE}: connect ECONNREFUSED` },
    ]);
  });

  it("leaves the vote claimed and survives when the revert itself fails", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    send.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    mocks.updateVote
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("pool exhausted"));

    await expect(
      service.payout(ALICE, "Alice", SERVER),
    ).resolves.toBeUndefined();

    expect(updatedWith(1)).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the stamp and notes a failed xp, and never repeats the bill", async () => {
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
      STAMPED,
      { rewardError: `${XP}: No player was found` },
    ]);
    expect(updatedWith(2)).toEqual([]);

    await service.payout(ALICE, "Alice", SERVER);

    expect(gives()).toHaveLength(2);
    expect(updatedWith(1)).toHaveLength(2);
    expect(updatedWith(2)).toEqual([STAMPED]);
  });

  it("still counts the votes as paid when only the thank-you fails", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    send.mockImplementation(async (_serverId, command) => {
      if (command.startsWith("tellraw")) throw new Error("gone");
      return okReply(command);
    });

    await service.payout(ALICE, "Alice", SERVER);

    expect(updatedWith(1)).toEqual([STAMPED]);
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
    expect(gives()).toHaveLength(1);
  });

  it("pays nothing on a server that is not a reward server", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    await service.payout(ALICE, "Alice", TEST_SERVER);

    expect(mocks.getPending).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("VoteRewardService on a session start", () => {
  it("pays the joining player on the reward server they joined", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    playtime.emit("sessionStart", sessionStart(SERVER));
    await vi.waitFor(() => expect(updatedWith(1)).toHaveLength(1));

    expect(send).toHaveBeenCalledWith(SERVER, GIVE);
  });

  it("ignores sessions on other servers", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    testPlaytime.emit("sessionStart", sessionStart(TEST_SERVER));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mocks.getPending).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("covers a reward server brought up after initialization", async () => {
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);
    const late = new EventEmitter();
    for (const listener of listeners) {
      listener(SERVER, late as never);
    }

    late.emit("sessionStart", sessionStart(SERVER));
    await vi.waitFor(() => expect(updatedWith(1)).toHaveLength(1));

    expect(send).toHaveBeenCalledWith(SERVER, GIVE);
  });
});

describe("VoteRewardService.sweep", () => {
  it("pays players online on a reward server and skips the others", async () => {
    mocks.getPendingPlayerUuids.mockResolvedValue([ALICE, "bob", "carol"]);
    mocks.findPlayers.mockResolvedValue([
      {
        minecraftUuid: ALICE,
        minecraftUsername: "Alice",
        online: true,
        currentServerId: SERVER,
      },
      {
        minecraftUuid: "bob",
        minecraftUsername: "Bob",
        online: true,
        currentServerId: TEST_SERVER,
      },
      {
        minecraftUuid: "carol",
        minecraftUsername: "Carol",
        online: true,
        currentServerId: null,
      },
    ]);
    mocks.getPending.mockResolvedValue([vote(1, "2026-10-01T10:00:00Z")]);

    await service.sweep();

    expect(mocks.findPlayers).toHaveBeenCalledWith({
      minecraftUuid: { $in: [ALICE, "bob", "carol"] },
      online: true,
    });
    expect(mocks.getPending).toHaveBeenCalledTimes(1);
    expect(mocks.getPending).toHaveBeenCalledWith(ALICE);
    expect(send).toHaveBeenCalledWith(SERVER, GIVE);
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
