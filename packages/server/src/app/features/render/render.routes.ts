import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "@/app/middleware/async-handler";
import config from "@/config";
import { Q, playerRepo, playtimeRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { formatPlaytime } from "@createrington/shared/format";
import {
  STAT_CATEGORY_LABELS,
  formatStatCategory,
  formatStatItem,
} from "@createrington/shared/minecraft-stats";
import {
  DesignCodeError,
  designCode,
  parseDesignCode,
} from "@createrington/shared/team-tag";
import { UnauthorizedError } from "@/errors";
import { requireLoopback } from "@/app/middleware/server-ip.middleware";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";

async function partyTagCodes(
  minecraftUuids: string[],
): Promise<Map<string, string>> {
  const rows = await Q.server.party.getMemberTagCodes(
    config.servers.rails.id,
    minecraftUuids,
  );
  return new Map(rows.map((row) => [row.minecraftUuid, row.tagCode]));
}

const router = Router();

router.use(requireLoopback);

function requirePuppeteerSecret(
  req: Request,
  _res: Response,
  next: () => void,
) {
  const secret = req.headers["x-render-secret"];
  const expected = config.puppeteer.secret;
  if (
    typeof secret !== "string" ||
    !expected ||
    !timingSafeEqualStrings(secret, expected)
  ) {
    throw new UnauthorizedError("Invalid render secret");
  }
  next();
}

router.get(
  "/compare",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { player1, player2 } = req.query;

    if (
      !player1 ||
      !player2 ||
      typeof player1 !== "string" ||
      typeof player2 !== "string"
    ) {
      res
        .status(400)
        .json({ error: "player1 and player2 query params required" });
      return;
    }

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
  }),
);

router.get(
  "/profile",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.query;

    if (!player || typeof player !== "string") {
      res.status(400).json({ error: "player query param required" });
      return;
    }

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
  }),
);

router.get(
  "/activity",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.query;

    if (!player || typeof player !== "string") {
      res.status(400).json({ error: "player query param required" });
      return;
    }

    const target = await Q.player.get({ discordId: player });
    const [activity, tags] = await Promise.all([
      playtimeRepo.getPlayerActivity(target),
      partyTagCodes([target.minecraftUuid]),
    ]);

    res.json({
      ...activity,
      username: target.minecraftUsername,
      uuid: target.minecraftUuid,
      mostActiveDay: activity.mostActiveDay ?? "N/A",
      tagCode: tags.get(target.minecraftUuid) ?? null,
    });
  }),
);

router.get(
  "/top",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, item } = req.query;

    if (
      !category ||
      !item ||
      typeof category !== "string" ||
      typeof item !== "string"
    ) {
      res
        .status(400)
        .json({ error: "category and item query params required" });
      return;
    }

    if (!Object.hasOwn(STAT_CATEGORY_LABELS, category)) {
      res.status(400).json({ error: "Invalid stat category" });
      return;
    }

    const results = await Q.player.minecraft.stat.total.compareItem(
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
  }),
);

router.get(
  "/tag",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler((req: Request, res: Response) => {
    const { design } = req.query;

    if (!design || typeof design !== "string") {
      res.status(400).json({ error: "design query param required" });
      return;
    }

    try {
      res.json({ tagCode: designCode(parseDesignCode(design)) });
    } catch (error) {
      if (!(error instanceof DesignCodeError)) throw error;
      res.status(400).json({ error: error.message });
    }
  }),
);

router.get(
  "/records",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (_req: Request, res: Response) => {
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
  }),
);

export default router;
