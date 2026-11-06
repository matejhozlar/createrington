import { Q, playtimeRepo } from "@/db";
import type { Player } from "@/generated/db";
import {
  LEADERBOARD_BOARDS,
  leaderboardBoardService,
  type BoardSnapshot,
  type LeaderboardBoard,
} from "./board.service";

export interface Contender {
  minecraftUuid: string;
  minecraftUsername: string;
  ranks: Record<LeaderboardBoard, number | null>;
}

export interface ComparedPlayer extends Contender {
  playtimeSeconds: number;
  balance: number;
  records: number;
  sessions: number;
  streak: number;
  memberSince: Date;
}

/**
 * Builds the headline side of a head-to-head comparison: each player's rank
 * and value on the three boards (read from the board service's minute-long
 * snapshots, so a comparison never recomputes a board), plus their session
 * count, current daily streak and join date.
 */
export class LeaderboardCompareService {
  /** Both players' headline stats, in the order given. */
  async compare(
    first: Player,
    second: Player,
  ): Promise<[ComparedPlayer, ComparedPlayer]> {
    const boards = await this.boards();
    return Promise.all([this.side(first, boards), this.side(second, boards)]);
  }

  /** One player's identity and board ranks, for a comparison still missing its second player. */
  async contender(player: Player): Promise<Contender> {
    return this.contenderOf(player, await this.boards());
  }

  private async boards(): Promise<Map<LeaderboardBoard, BoardSnapshot>> {
    const snapshots = await Promise.all(
      LEADERBOARD_BOARDS.map((board) =>
        leaderboardBoardService.getBoard(board),
      ),
    );
    return new Map(
      LEADERBOARD_BOARDS.map((board, index) => [board, snapshots[index]]),
    );
  }

  private contenderOf(
    player: Player,
    boards: Map<LeaderboardBoard, BoardSnapshot>,
  ): Contender {
    const rank = (board: LeaderboardBoard) =>
      boards
        .get(board)
        ?.rows.find((row) => row.minecraftUuid === player.minecraftUuid)
        ?.rank ?? null;
    return {
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
      ranks: {
        records: rank("records"),
        playtime: rank("playtime"),
        balance: rank("balance"),
      },
    };
  }

  private async side(
    player: Player,
    boards: Map<LeaderboardBoard, BoardSnapshot>,
  ): Promise<ComparedPlayer> {
    const [summaries, activity] = await Promise.all([
      Q.player.playtime.summary.findAll({
        playerMinecraftUuid: player.minecraftUuid,
      }),
      playtimeRepo.getPlayerActivity(player),
    ]);
    const entry = (board: LeaderboardBoard) =>
      boards
        .get(board)
        ?.rows.find((row) => row.minecraftUuid === player.minecraftUuid);

    return {
      ...this.contenderOf(player, boards),
      playtimeSeconds: activity.totalSeconds,
      balance: entry("balance")?.value ?? 0,
      records: entry("records")?.value ?? 0,
      sessions: summaries.reduce(
        (sum, summary) => sum + summary.totalSessions,
        0,
      ),
      streak: activity.currentStreak,
      memberSince: player.createdAt,
    };
  }
}

export const leaderboardCompareService = new LeaderboardCompareService();
