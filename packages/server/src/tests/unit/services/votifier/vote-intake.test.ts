import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlayers: vi.fn(),
  recordVote: vi.fn(),
  send: vi.fn(),
  payout: vi.fn(),
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
      vote: { record: mocks.recordVote },
    },
  },
}));

import {
  VoteIntake,
  type MessageServiceProvider,
  type VoteRewardServiceProvider,
} from "@/services/votifier/vote-intake";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import type { VoteRewardService } from "@/services/votifier/vote-reward.service";

const CHANNEL = "123456789012345678";
const PLAYER = {
  minecraftUuid: "aaaa0000-0000-4000-8000-000000000031",
  minecraftUsername: "Agent772",
  online: false,
  currentServerId: null,
};
const ONLINE_PLAYER = { ...PLAYER, online: true, currentServerId: 1 };
const VOTED_AT = new Date("2026-10-20T10:00:00Z");

const messageService = { send: mocks.send } as unknown as DiscordMessageService;
const rewardService = { payout: mocks.payout } as unknown as VoteRewardService;

function intake(
  provider: MessageServiceProvider = () => messageService,
  rewards: VoteRewardServiceProvider = () => rewardService,
): VoteIntake {
  return new VoteIntake(provider, CHANNEL, rewards);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ success: true, messageId: "1" });
  mocks.payout.mockResolvedValue(undefined);
  mocks.recordVote.mockImplementation(async (data) => ({ id: 7, ...data }));
});

describe("VoteIntake.accept", () => {
  it("stores the vote linked to the registered player and announces it", async () => {
    mocks.findPlayers.mockResolvedValue([PLAYER]);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "agent772",
      timestamp: VOTED_AT,
    });

    expect(mocks.findPlayers).toHaveBeenCalledWith(
      { minecraftUsername: { $ilike: "agent772" } },
      { limit: 1 },
    );
    expect(mocks.recordVote).toHaveBeenCalledWith({
      username: "agent772",
      serviceName: "createmodservers.com",
      votedAt: VOTED_AT,
      playerMinecraftUuid: PLAYER.minecraftUuid,
    });
    expect(mocks.send).toHaveBeenCalledWith({
      channelId: CHANNEL,
      content: "**Agent772** voted for the server on createmodservers.com!",
    });
    expect(mocks.payout).not.toHaveBeenCalled();
  });

  it("pays a voter who is online right away", async () => {
    mocks.findPlayers.mockResolvedValue([ONLINE_PLAYER]);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Agent772",
      timestamp: VOTED_AT,
    });

    expect(mocks.payout).toHaveBeenCalledWith(
      PLAYER.minecraftUuid,
      "Agent772",
      1,
    );
  });

  it("acknowledges the vote without waiting for the payout", async () => {
    mocks.findPlayers.mockResolvedValue([ONLINE_PLAYER]);
    mocks.payout.mockReturnValue(new Promise(() => {}));

    await expect(
      intake().accept({
        serviceName: "createmodservers.com",
        username: "Agent772",
        timestamp: VOTED_AT,
      }),
    ).resolves.toBeUndefined();
  });

  it("leaves an online voter to the join and sweep while the reward service is not ready", async () => {
    mocks.findPlayers.mockResolvedValue([ONLINE_PLAYER]);

    await intake(undefined, () => null).accept({
      serviceName: "createmodservers.com",
      username: "Agent772",
      timestamp: VOTED_AT,
    });

    expect(mocks.recordVote).toHaveBeenCalledTimes(1);
    expect(mocks.payout).not.toHaveBeenCalled();
  });

  it("stores a vote for an unknown username unlinked and stays quiet", async () => {
    mocks.findPlayers.mockResolvedValue([]);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Stranger",
      timestamp: VOTED_AT,
    });

    expect(mocks.recordVote).toHaveBeenCalledWith(
      expect.objectContaining({ playerMinecraftUuid: null }),
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("escapes LIKE wildcards in the username lookup", async () => {
    mocks.findPlayers.mockResolvedValue([]);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Agent_772",
      timestamp: VOTED_AT,
    });

    expect(mocks.findPlayers).toHaveBeenCalledWith(
      { minecraftUsername: { $ilike: "Agent\\_772" } },
      { limit: 1 },
    );
  });

  it("uses the arrival time when the vote carries no timestamp", async () => {
    mocks.findPlayers.mockResolvedValue([]);
    const before = Date.now();

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Agent772",
      timestamp: null,
    });

    const votedAt: Date = mocks.recordVote.mock.calls[0]![0].votedAt;
    expect(votedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not announce a redelivered vote", async () => {
    mocks.findPlayers.mockResolvedValue([ONLINE_PLAYER]);
    mocks.recordVote.mockResolvedValue(null);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Agent772",
      timestamp: VOTED_AT,
    });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.payout).not.toHaveBeenCalled();
  });

  it("ignores a vote for something that is not a Minecraft username", async () => {
    await intake().accept({
      serviceName: "createmodservers.com",
      username: "<script>alert(1)</script>",
      timestamp: VOTED_AT,
    });

    expect(mocks.findPlayers).not.toHaveBeenCalled();
    expect(mocks.recordVote).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps the stored vote when the announcement fails", async () => {
    mocks.findPlayers.mockResolvedValue([PLAYER]);
    mocks.send.mockResolvedValue({ success: false, error: "no channel" });

    await expect(
      intake().accept({
        serviceName: "createmodservers.com",
        username: "Agent772",
        timestamp: VOTED_AT,
      }),
    ).resolves.toBeUndefined();

    expect(mocks.recordVote).toHaveBeenCalledTimes(1);
  });

  it("stores the vote without a shout-out while the Discord bot is not ready", async () => {
    mocks.findPlayers.mockResolvedValue([PLAYER]);

    await expect(
      intake(() => null).accept({
        serviceName: "createmodservers.com",
        username: "Agent772",
        timestamp: VOTED_AT,
      }),
    ).resolves.toBeUndefined();

    expect(mocks.recordVote).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
