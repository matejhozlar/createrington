import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlayers: vi.fn(),
  recordVote: vi.fn(),
  send: vi.fn(),
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
} from "@/services/votifier/vote-intake";
import type { DiscordMessageService } from "@/services/discord/message/message.service";

const CHANNEL = "123456789012345678";
const PLAYER = {
  minecraftUuid: "aaaa0000-0000-4000-8000-000000000031",
  minecraftUsername: "Agent772",
};
const VOTED_AT = new Date("2026-10-20T10:00:00Z");

const messageService = { send: mocks.send } as unknown as DiscordMessageService;

function intake(
  provider: MessageServiceProvider = () => messageService,
): VoteIntake {
  return new VoteIntake(provider, CHANNEL);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ success: true, messageId: "1" });
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

    const votedAt: Date = mocks.recordVote.mock.calls[0][0].votedAt;
    expect(votedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not announce a redelivered vote", async () => {
    mocks.findPlayers.mockResolvedValue([PLAYER]);
    mocks.recordVote.mockResolvedValue(null);

    await intake().accept({
      serviceName: "createmodservers.com",
      username: "Agent772",
      timestamp: VOTED_AT,
    });

    expect(mocks.send).not.toHaveBeenCalled();
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
