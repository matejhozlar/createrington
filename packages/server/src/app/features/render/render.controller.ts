import type { Request, Response } from "express";
import { getValidated } from "@/app/middleware/validation.middleware";
import config from "@/config";
import { Q, playerRepo } from "@/db";
import { getPlayerActivity } from "@/services/playtime/activity";
import { BalanceUtils } from "@/db/utils/balance";
import { formatPlaytime } from "@createrington/shared/format";
import {
  formatStatCategory,
  formatStatItem,
} from "@createrington/shared/minecraft-stats";
import {
  DesignCodeError,
  designCode,
  parseDesignCode,
} from "@createrington/shared/team-tag";
import { BadRequestError } from "@/errors";

import type {
  CompareQuery,
  DesignQuery,
  PlayerQuery,
  TopQuery,
} from "./render.schemas";

async function partyTagCodes(
  minecraftUuids: string[],
): Promise<Map<string, string>> {
  const rows = await Q.server.party.getMemberTagCodes(
    config.servers.rails.id,
    minecraftUuids,
  );
  return new Map(rows.map((row) => [row.minecraftUuid, row.tagCode]));
}

export class RenderController {
  static async compare(_req: Request, res: Response): Promise<void> {
    const { player1, player2 } = getValidated<{ query: CompareQuery }>(
      res,
    ).query;

    const [details1, details2] = await Promise.all([
      playerRepo.getDetailed({ discordId: player1 }),
      playerRepo.getDetailed({ discordId: player2 }),
    ]);
    const tags = await partyTagCodes([
      details1.player.minecraftUuid,
      details2.player.minecraftUuid,
    ]);

    const mapPlayer = (details: typeof details1) => {
      const networth = details.balance
        ? BalanceUtils.fromStorage(details.balance.balance)
        : 0;
      const formatted = networth.toFixed(3).replace(/\.?0+$/, "") || "0";
      return {
        username: details.player.minecraftUsername,
        uuid: details.player.minecraftUuid,
        networth: formatted,
        playtime: formatPlaytime(details.playtime.totalSeconds),
        playtimeSeconds: details.playtime.totalSeconds,
        sessions: details.playtime.totalSessions,
        memberSince: details.player.createdAt.toISOString(),
        tagCode: tags.get(details.player.minecraftUuid) ?? null,
      };
    };

    res.json({
      player1: mapPlayer(details1),
      player2: mapPlayer(details2),
    });
  }

  static async profile(_req: Request, res: Response): Promise<void> {
    const { player } = getValidated<{ query: PlayerQuery }>(res).query;

    const details = await playerRepo.getDetailed({ discordId: player });

    const cashBalance = details.balance
      ? BalanceUtils.fromStorage(details.balance.balance)
      : 0;

    const fmt = (n: number) => n.toFixed(3).replace(/\.?0+$/, "") || "0";

    const [{ blocksMined, mobsKilled, deaths, distanceCm }, tags] =
      await Promise.all([
        Q.player.minecraft.stat.total.getProfileHighlights(
          details.player.minecraftUuid,
        ),
        partyTagCodes([details.player.minecraftUuid]),
      ]);
    const distanceKm = Math.round(distanceCm / 100_000);

    res.json({
      username: details.player.minecraftUsername,
      uuid: details.player.minecraftUuid,
      online: details.player.online,
      cashBalance: fmt(cashBalance),
      playtime: formatPlaytime(details.playtime.totalSeconds),
      playtimeSeconds: details.playtime.totalSeconds,
      sessions: details.playtime.totalSessions,
      memberSince: details.player.createdAt.toISOString(),
      blocksMined,
      mobsKilled,
      deaths,
      distanceKm,
      tagCode: tags.get(details.player.minecraftUuid) ?? null,
    });
  }

  static async activity(_req: Request, res: Response): Promise<void> {
    const { player } = getValidated<{ query: PlayerQuery }>(res).query;

    const target = await Q.player.get({ discordId: player });
    const [activity, tags] = await Promise.all([
      getPlayerActivity(target),
      partyTagCodes([target.minecraftUuid]),
    ]);

    res.json({
      ...activity,
      username: target.minecraftUsername,
      uuid: target.minecraftUuid,
      mostActiveDay: activity.mostActiveDay ?? "N/A",
      tagCode: tags.get(target.minecraftUuid) ?? null,
    });
  }

  static async top(_req: Request, res: Response): Promise<void> {
    const { category, item } = getValidated<{ query: TopQuery }>(res).query;

    const results = await Q.player.minecraft.stat.total.getItemComparison(
      item,
      [category],
      { limit: 3 },
    );

    const tags = await partyTagCodes(results.map((r) => r.minecraftUuid));

    const itemName = formatStatItem(category, item);
    const displayTitle =
      category === "minecraft:custom"
        ? itemName
        : `${formatStatCategory(category)} ${itemName}`;

    res.json({
      category,
      item,
      displayTitle,
      players: results.map((r) => ({
        username: r.minecraftUsername,
        uuid: r.minecraftUuid,
        value: r.values[0] ?? 0,
        tagCode: tags.get(r.minecraftUuid) ?? null,
      })),
    });
  }

  static tag(_req: Request, res: Response): void {
    const { design } = getValidated<{ query: DesignQuery }>(res).query;

    try {
      res.json({ tagCode: designCode(parseDesignCode(design)) });
    } catch (error) {
      if (!(error instanceof DesignCodeError)) throw error;
      throw new BadRequestError(error.message);
    }
  }

  static async records(_req: Request, res: Response): Promise<void> {
    const { rows, contestedKeys } =
      await Q.player.minecraft.stat.total.getRecordLeaderboard(3);
    const tags = await partyTagCodes(rows.map((row) => row.minecraftUuid));

    res.json({
      contestedKeys,
      players: rows.map((row) => ({
        username: row.minecraftUsername,
        uuid: row.minecraftUuid,
        value: row.records,
        tagCode: tags.get(row.minecraftUuid) ?? null,
      })),
    });
  }
}
