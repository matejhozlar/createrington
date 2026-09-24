import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  records: vi.fn(),
  playtime: vi.fn(),
  balances: vi.fn(),
  players: vi.fn(),
  statRanking: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      getAll: db.players,
      balance: { getAllBalances: db.balances },
      playtime: { summary: { getGlobalLeaderboard: db.playtime } },
      minecraft: {
        stat: {
          total: {
            getRecordLeaderboard: db.records,
            getStatRanking: db.statRanking,
          },
        },
      },
    },
  },
}));

import { LeaderboardBoardService } from "@/services/leaderboard/board.service";

function playtimeRow(name: string, totalSeconds: number) {
  return {
    discordId: `d-${name}`,
    minecraftUsername: name,
    playerMinecraftUuid: `u-${name}`,
    totalSeconds,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("LeaderboardBoardService", () => {
  it("ranks playtime with competition numbering and drops players without playtime", async () => {
    db.playtime.mockResolvedValue([
      playtimeRow("alice", 3600),
      playtimeRow("bob", 3600),
      playtimeRow("carol", 1800),
      playtimeRow("dave", 0),
    ]);

    const { rows } = await new LeaderboardBoardService().getBoard("playtime");

    expect(rows.map((row) => [row.rank, row.minecraftUsername])).toEqual([
      [1, "alice"],
      [1, "bob"],
      [3, "carol"],
    ]);
    expect(db.playtime).toHaveBeenCalledWith();
  });

  it("ranks every balance holder, not just the top of the board", async () => {
    db.balances.mockResolvedValue([
      { minecraftUuid: "u-poor", balance: 5 },
      { minecraftUuid: "u-rich", balance: 500.5 },
      { minecraftUuid: "u-mid", balance: 50 },
    ]);
    db.players.mockResolvedValue([
      { minecraftUuid: "u-rich", minecraftUsername: "rich" },
      { minecraftUuid: "u-mid", minecraftUsername: "mid" },
      { minecraftUuid: "u-poor", minecraftUsername: "poor" },
    ]);

    const { rows } = await new LeaderboardBoardService().getBoard("balance");

    expect(rows).toEqual([
      {
        rank: 1,
        minecraftUuid: "u-rich",
        minecraftUsername: "rich",
        value: 500.5,
      },
      { rank: 2, minecraftUuid: "u-mid", minecraftUsername: "mid", value: 50 },
      { rank: 3, minecraftUuid: "u-poor", minecraftUsername: "poor", value: 5 },
    ]);
  });

  it("carries the contested key count with the records board", async () => {
    db.records.mockResolvedValue({
      contestedKeys: 42,
      rows: [
        {
          minecraftUuid: "u-a",
          minecraftUsername: "a",
          discordId: "d-a",
          records: 7,
        },
      ],
    });

    const snapshot = await new LeaderboardBoardService().getBoard("records");

    expect(snapshot.contestedKeys).toBe(42);
    expect(snapshot.rows).toEqual([
      { rank: 1, minecraftUuid: "u-a", minecraftUsername: "a", value: 7 },
    ]);
    expect(db.records).toHaveBeenCalledWith();
  });

  it("shares one computation between concurrent readers and refreshes after the ttl", async () => {
    vi.useFakeTimers();
    db.playtime.mockResolvedValue([playtimeRow("alice", 10)]);
    const service = new LeaderboardBoardService();

    await Promise.all([
      service.getBoard("playtime"),
      service.getBoard("playtime"),
    ]);
    await service.getBoard("playtime");
    expect(db.playtime).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61 * 1000);
    await service.getBoard("playtime");
    expect(db.playtime).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed computation", async () => {
    db.playtime
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce([playtimeRow("alice", 10)]);
    const service = new LeaderboardBoardService();

    await expect(service.getBoard("playtime")).rejects.toThrow("db down");
    const { rows } = await service.getBoard("playtime");

    expect(rows).toHaveLength(1);
    expect(db.playtime).toHaveBeenCalledTimes(2);
  });

  it("ranks a single stat and caches it per stat", async () => {
    db.statRanking.mockResolvedValue([
      { minecraftUuid: "u-a", minecraftUsername: "alice", value: 40 },
      { minecraftUuid: "u-b", minecraftUsername: "bob", value: 40 },
      { minecraftUuid: "u-c", minecraftUsername: "carol", value: 7 },
    ]);
    const service = new LeaderboardBoardService();

    const { rows } = await service.getStatBoard(
      "minecraft:mined",
      "minecraft:diamond_ore",
    );
    await service.getStatBoard("minecraft:mined", "minecraft:diamond_ore");
    await service.getStatBoard("minecraft:used", "minecraft:diamond_ore");

    expect(rows.map((row) => [row.rank, row.minecraftUsername])).toEqual([
      [1, "alice"],
      [1, "bob"],
      [3, "carol"],
    ]);
    expect(db.statRanking).toHaveBeenCalledTimes(2);
    expect(db.statRanking).toHaveBeenCalledWith(
      "minecraft:used",
      "minecraft:diamond_ore",
    );
  });
});
