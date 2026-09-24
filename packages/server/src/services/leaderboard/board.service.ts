import { Q } from "@/db";
import { rankNetWorth } from "@/services/discord/leaderboard/networth";

export const LEADERBOARD_BOARDS = ["records", "playtime", "balance"] as const;
export type LeaderboardBoard = (typeof LEADERBOARD_BOARDS)[number];

export interface BoardRow {
  rank: number;
  minecraftUuid: string;
  minecraftUsername: string;
  value: number;
}

export interface BoardSnapshot {
  rows: BoardRow[];
  contestedKeys: number;
}

const SNAPSHOT_TTL_MS = 60 * 1000;
const MAX_CACHED_STATS = 200;

interface CachedSnapshot {
  promise: Promise<BoardSnapshot>;
  expiresAt: number;
}

function withRanks(entries: Array<Omit<BoardRow, "rank">>): BoardRow[] {
  let rank = 0;
  let previous: number | null = null;

  return entries.map((entry, index) => {
    if (entry.value !== previous) {
      rank = index + 1;
      previous = entry.value;
    }
    return { rank, ...entry };
  });
}

/**
 * Serves the full ranked player lists behind the website leaderboards. Each
 * board is computed in one pass over every player (the records board expands
 * every stats row, so it is not cheap) and memoised for a minute, with
 * concurrent callers sharing the in-flight computation. Ranks use competition
 * numbering (tied values share a rank, the next rank is skipped), so a
 * searched or paginated slice keeps the player's real position. Single-stat
 * boards (any category + item) are cached the same way, keeping at most the
 * MAX_CACHED_STATS most recently computed ones.
 */
export class LeaderboardBoardService {
  private cache = new Map<LeaderboardBoard, CachedSnapshot>();
  private statCache = new Map<string, CachedSnapshot>();

  /** The complete ranked board, served from the minute-long cache when fresh. */
  getBoard(board: LeaderboardBoard): Promise<BoardSnapshot> {
    const cached = this.cache.get(board);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = this.compute(board).catch((error) => {
      this.cache.delete(board);
      throw error;
    });
    this.cache.set(board, {
      promise,
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
    });
    return promise;
  }

  /** The complete ranked board for one stat, e.g. minecraft:mined + minecraft:diamond_ore. */
  getStatBoard(category: string, item: string): Promise<BoardSnapshot> {
    const key = JSON.stringify([category, item]);
    const cached = this.statCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = this.computeStat(category, item).catch((error) => {
      this.statCache.delete(key);
      throw error;
    });
    this.statCache.delete(key);
    this.statCache.set(key, {
      promise,
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
    });
    while (this.statCache.size > MAX_CACHED_STATS) {
      const oldest = this.statCache.keys().next().value;
      if (oldest === undefined) break;
      this.statCache.delete(oldest);
    }
    return promise;
  }

  /** Drops every cached board so the next read recomputes. */
  invalidate(): void {
    this.cache.clear();
    this.statCache.clear();
  }

  private compute(board: LeaderboardBoard): Promise<BoardSnapshot> {
    switch (board) {
      case "records":
        return this.computeRecords();
      case "playtime":
        return this.computePlaytime();
      case "balance":
        return this.computeBalance();
    }
  }

  private async computeRecords(): Promise<BoardSnapshot> {
    const { rows, contestedKeys } =
      await Q.player.minecraft.stat.total.getRecordLeaderboard();

    return {
      contestedKeys,
      rows: withRanks(
        rows.map((row) => ({
          minecraftUuid: row.minecraftUuid,
          minecraftUsername: row.minecraftUsername,
          value: row.records,
        })),
      ),
    };
  }

  private async computeStat(
    category: string,
    item: string,
  ): Promise<BoardSnapshot> {
    const rows = await Q.player.minecraft.stat.total.getStatRanking(
      category,
      item,
    );
    return { contestedKeys: 0, rows: withRanks(rows) };
  }

  private async computePlaytime(): Promise<BoardSnapshot> {
    const rows = await Q.player.playtime.summary.getGlobalLeaderboard();

    return {
      contestedKeys: 0,
      rows: withRanks(
        rows
          .filter((row) => row.totalSeconds > 0)
          .map((row) => ({
            minecraftUuid: row.playerMinecraftUuid,
            minecraftUsername: row.minecraftUsername,
            value: row.totalSeconds,
          })),
      ),
    };
  }

  private async computeBalance(): Promise<BoardSnapshot> {
    const [balances, players] = await Promise.all([
      Q.player.balance.getAllBalances(),
      Q.player.getAll(),
    ]);
    const nameByUuid = new Map(
      players.map((p) => [p.minecraftUuid, p.minecraftUsername]),
    );

    return {
      contestedKeys: 0,
      rows: withRanks(
        rankNetWorth(balances, nameByUuid, balances.length).map((entry) => ({
          minecraftUuid: entry.playerUuid,
          minecraftUsername: entry.playerName,
          value: Number(entry.value),
        })),
      ),
    };
  }
}

export const leaderboardBoardService = new LeaderboardBoardService();
