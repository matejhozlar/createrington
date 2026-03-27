import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "@/app/middleware/async-handler";
import config from "@/config";
import { Q, playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { formatPlaytime } from "@/utils/format";
import { UnauthorizedError } from "@/app/middleware";
import { getService, Services } from "@/services";
import { getActiveEventsInMemory } from "@/services/crypto/events/event-engine";
import { EVENT_DEFINITIONS } from "@/services/crypto/events/event-definitions";

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
function requirePuppeteerSecret(
  req: Request,
  _res: Response,
  next: () => void,
) {
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

    const tokens = await Q.crypto.token.where({}).all();
    const tokenPriceMap = new Map(tokens.map((t) => [t.id, Number(t.price)]));

    const computeCryptoValue = async (uuid: string) => {
      const holdings = await Q.crypto.holding
        .where({ playerMinecraftUuid: uuid })
        .all();
      return holdings.reduce((sum, h) => {
        const price = tokenPriceMap.get(h.tokenId) ?? 0;
        return sum + price * Number(h.amount);
      }, 0);
    };

    const [crypto1, crypto2] = await Promise.all([
      computeCryptoValue(details1.player.minecraftUuid),
      computeCryptoValue(details2.player.minecraftUuid),
    ]);

    const mapPlayer = (details: typeof details1, cryptoValue: number) => {
      const cashBalance = details.balance
        ? BalanceUtils.fromStorage(details.balance.balance)
        : 0;
      const networth = cashBalance + cryptoValue;
      const formatted = networth.toFixed(3).replace(/\.?0+$/, "") || "0";
      return {
        username: details.player.minecraftUsername,
        uuid: details.player.minecraftUuid,
        networth: formatted,
        playtime: formatPlaytime(details.playtime.totalSeconds),
        playtimeSeconds: details.playtime.totalSeconds,
        sessions: details.playtime.totalSessions,
        memberSince: details.player.createdAt.toISOString(),
      };
    };

    res.json({
      player1: mapPlayer(details1, crypto1),
      player2: mapPlayer(details2, crypto2),
    });
  }),
);

/**
 * GET /api/render/crypto-chart?secret=...&symbol=...&interval=...
 *
 * Returns token data and OHLCV price history for the chart render page.
 * Protected by puppeteer secret — not accessible to regular users.
 */
router.get(
  "/crypto-chart",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, interval = "minute" } = req.query;

    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "symbol query param required" });
      return;
    }

    const validIntervals = [
      "tick",
      "minute",
      "hourly",
      "daily",
      "weekly",
    ] as const;
    type PriceInterval = (typeof validIntervals)[number];
    const resolvedInterval: PriceInterval =
      typeof interval === "string" &&
      validIntervals.includes(interval as PriceInterval)
        ? (interval as PriceInterval)
        : "minute";

    const token = await Q.crypto.token
      .where({ symbol: symbol.toUpperCase() })
      .first();

    if (!token) {
      res.status(404).json({ error: `Token ${symbol} not found` });
      return;
    }

    const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);
    const change24h = cryptoService.get24hChange(token.id, token.price);
    const volume24h = String(cryptoService.getTokenVolume24h(token.id));

    const snapshots = await Q.crypto.price.snapshot
      .where({ tokenId: token.id, interval: resolvedInterval })
      .orderBy("recordedAt", "desc")
      .limit(200)
      .all();

    const priceHistory = snapshots.reverse().map((s) => ({
      time: Math.floor(s.recordedAt.getTime() / 1000),
      open: Number(s.openPrice),
      high: Number(s.highPrice),
      low: Number(s.lowPrice),
      close: Number(s.closePrice),
      volume: Number(s.volume),
    }));

    const circulatingSupply = Number(token.totalSupply - token.availableSupply);
    const marketCap = Number(token.price) * circulatingSupply;

    // Check for active events affecting this token
    const activeEvents = getActiveEventsInMemory();
    const tokenEvent = activeEvents.find(
      (e) => e.tokenId === token.id || e.tokenId === null,
    );
    const activeEvent = tokenEvent
      ? {
          name:
            EVENT_DEFINITIONS[tokenEvent.type as keyof typeof EVENT_DEFINITIONS]
              ?.name ?? tokenEvent.type,
          activeUntil: tokenEvent.activeUntil?.toISOString() ?? null,
        }
      : null;

    res.json({
      token: {
        name: token.name,
        symbol: token.symbol,
        category: token.category,
        price: token.price,
        totalSupply: String(token.totalSupply),
        availableSupply: String(token.availableSupply),
        circulatingSupply: String(circulatingSupply),
        marketCap: marketCap.toFixed(2),
        isCrashed: token.isCrashed,
        ipoEndsAt: token.ipoEndsAt?.toISOString() ?? null,
      },
      change24h,
      volume24h,
      activeEvent,
      interval: resolvedInterval,
      priceHistory,
    });
  }),
);

export default router;
