import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "@/app/middleware/async-handler";
import config from "@/config";
import { playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { formatPlaytime } from "@/utils/format";
import { UnauthorizedError } from "@/app/middleware";

const router = Router();

/**
 * Render routes
 * Base path: /api/render
 *
 * Internal endpoints consumed by PuppeteerService to generate
 * server-rendered HTML snapshots (e.g. player comparison images).
 * Protected by a shared secret — not accessible to regular users.
 */

/**
 * Validates the puppeteer secret query param.
 * Only the internal PuppeteerService should know this secret.
 */
function requirePuppeteerSecret(req: Request, _res: Response, next: () => void) {
  const secret = req.query.secret;
  if (!secret || secret !== config.puppeteer.secret) {
    throw new UnauthorizedError("Invalid render secret");
  }
  next();
}

/**
 * GET /api/render/compare?secret=...&player1=...&player2=...
 *
 * Returns comparison data for two players identified by Discord ID.
 * Protected by puppeteer secret — not accessible to regular users.
 */
router.get(
  "/compare",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { player1, player2 } = req.query;

    if (!player1 || !player2 || typeof player1 !== "string" || typeof player2 !== "string") {
      res.status(400).json({ error: "player1 and player2 query params required" });
      return;
    }

    const [details1, details2] = await Promise.all([
      playerRepo.getDetailed({ discordId: player1 }),
      playerRepo.getDetailed({ discordId: player2 }),
    ]);

    const mapPlayer = (details: typeof details1) => ({
      username: details.player.minecraftUsername,
      uuid: details.player.minecraftUuid,
      balance: details.balance ? BalanceUtils.formatTrimmed(details.balance.balance) : "0",
      playtime: formatPlaytime(details.playtime.totalSeconds),
      playtimeSeconds: details.playtime.totalSeconds,
      sessions: details.playtime.totalSessions,
      memberSince: details.player.createdAt.toISOString(),
    });

    res.json({
      player1: mapPlayer(details1),
      player2: mapPlayer(details2),
    });
  }),
);

export default router;
