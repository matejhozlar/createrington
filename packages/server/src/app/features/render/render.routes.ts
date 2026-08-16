import { Router } from "express";
import type { Request, Response } from "express";
import {
  KNOWN_POSES,
  randomPose,
  type KnownPose,
} from "createrington-skin-api";
import { asyncHandler } from "@/app/middleware/async-handler";
import config from "@/config";
import { Q, playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { formatPlaytime, toUnixSeconds } from "@/utils/format";
import { UnauthorizedError } from "@/app/middleware";
import { requireLoopback } from "@/app/middleware/server-ip.middleware";
import { getService, Services } from "@/services";
import { getSkinApiClient, MAX_QUALITY_RENDER } from "@/services/skin-api";
import { getActiveEventsInMemory } from "@/services/crypto/events/event-engine";
import { EVENT_DEFINITIONS } from "@/services/crypto/events/event-definitions";
import { timingSafeEqualStrings } from "@/utils/timing-safe-equal";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";

const SKIN_RENDER_CACHE_SECONDS = 24 * 60 * 60;
const KNOWN_POSE_SET: ReadonlySet<KnownPose> = new Set(KNOWN_POSES);
const MC_HEADS_FALLBACK_URL = "https://mc-heads.net/body";
// mc-heads' unsized /body is 180x432, which the render pages display upscaled.
// 600 is its ceiling for this endpoint (1200 also returns 600x1441).
const MC_HEADS_FALLBACK_SIZE = 600;

const router = Router();

// PuppeteerService runs in-process and connects via loopback. Reject any
// off-host traffic at the router level so a leaked PUPPETEER_SECRET still
// cannot exfiltrate per-player PII over the public interface.
router.use(requireLoopback);

/**
 * Render routes
 * Base path: /api/render
 *
 * Internal endpoints consumed by PuppeteerService to generate
 * server-rendered HTML snapshots (e.g. player comparison images).
 * Protected by a shared secret, not accessible to regular users.
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

/**
 * GET /api/render/compare?secret=...&player1=...&player2=...
 *
 * Returns comparison data for two players identified by Discord ID.
 * Protected by puppeteer secret, not accessible to regular users.
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

    const tokens = await Q.crypto.token.getAll();
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
 * GET /api/render/profile?secret=...&player=...
 *
 * Returns profile data for a single player identified by Discord ID.
 * Protected by puppeteer secret, not accessible to regular users.
 */
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

    const tokens = await Q.crypto.token.getAll();
    const tokenPriceMap = new Map(tokens.map((t) => [t.id, Number(t.price)]));

    const cashBalance = details.balance
      ? BalanceUtils.fromStorage(details.balance.balance)
      : 0;

    const holdings = await Q.crypto.holding
      .where({ playerMinecraftUuid: details.player.minecraftUuid })
      .all();
    const cryptoValue = holdings.reduce((sum, h) => {
      const price = tokenPriceMap.get(h.tokenId) ?? 0;
      return sum + price * Number(h.amount);
    }, 0);

    const networth = cashBalance + cryptoValue;
    const fmt = (n: number) => n.toFixed(3).replace(/\.?0+$/, "") || "0";

    const statsRows = await Q.player.minecraft.stats.findAll({
      minecraftUuid: details.player.minecraftUuid,
    });

    let blocksMined = 0;
    let mobsKilled = 0;
    let deaths = 0;
    let distanceCm = 0;

    for (const row of statsRows) {
      const stats = row.stats as Record<string, Record<string, number>>;
      const mined = stats["minecraft:mined"];
      if (mined) {
        blocksMined += Object.values(mined).reduce((s, v) => s + v, 0);
      }
      const custom = stats["minecraft:custom"];
      if (custom) {
        mobsKilled += custom["minecraft:mob_kills"] ?? 0;
        deaths += custom["minecraft:deaths"] ?? 0;
        distanceCm +=
          (custom["minecraft:walk_one_cm"] ?? 0) +
          (custom["minecraft:sprint_one_cm"] ?? 0) +
          (custom["minecraft:boat_one_cm"] ?? 0) +
          (custom["minecraft:horse_one_cm"] ?? 0) +
          (custom["minecraft:fly_one_cm"] ?? 0) +
          (custom["minecraft:swim_one_cm"] ?? 0);
      }
    }

    const distanceKm = Math.round(distanceCm / 100_000);

    res.json({
      username: details.player.minecraftUsername,
      uuid: details.player.minecraftUuid,
      online: details.player.online,
      networth: fmt(networth),
      cashBalance: fmt(cashBalance),
      cryptoValue: fmt(cryptoValue),
      playtime: formatPlaytime(details.playtime.totalSeconds),
      playtimeSeconds: details.playtime.totalSeconds,
      sessions: details.playtime.totalSessions,
      memberSince: details.player.createdAt.toISOString(),
      blocksMined,
      mobsKilled,
      deaths,
      distanceKm,
    });
  }),
);

/**
 * GET /api/render/activity?secret=...&player=...
 *
 * Returns daily playtime data for the last 365 days, aggregated across servers.
 * Protected by puppeteer secret, not accessible to regular users.
 */
router.get(
  "/activity",
  asyncHandler(requirePuppeteerSecret),
  asyncHandler(async (req: Request, res: Response) => {
    const { player } = req.query;

    if (!player || typeof player !== "string") {
      res.status(400).json({ error: "player query param required" });
      return;
    }

    const details = await playerRepo.getDetailed({ discordId: player });
    const uuid = details.player.minecraftUuid;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const rows = await Q.player.playtime.daily
      .where({
        playerMinecraftUuid: uuid,
        playDate: { $gte: startDate },
      })
      .all();

    const dayMap: Record<string, number> = {};
    for (const row of rows) {
      const date =
        row.playDate instanceof Date
          ? row.playDate.toISOString().split("T")[0]
          : String(row.playDate);
      dayMap[date] = (dayMap[date] ?? 0) + Number(row.secondsPlayed);
    }

    // Use all-time total from playtime summary (not just 365-day window)
    const totalSeconds = details.playtime.totalSeconds;

    // Current streak: consecutive days ending today or yesterday
    let currentStreak = 0;
    const today = new Date();
    const check = new Date(today);
    // Start from today, then try yesterday if today has no data yet
    if (!dayMap[check.toISOString().split("T")[0]]) {
      check.setDate(check.getDate() - 1);
    }
    while (dayMap[check.toISOString().split("T")[0]]) {
      currentStreak++;
      check.setDate(check.getDate() - 1);
    }

    const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const [dateStr, seconds] of Object.entries(dayMap)) {
      const dow = new Date(dateStr).getUTCDay();
      dayTotals[dow] += seconds;
      dayCounts[dow]++;
    }
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    let bestDay = 0;
    let bestAvg = 0;
    for (let i = 0; i < 7; i++) {
      const avg = dayCounts[i] > 0 ? dayTotals[i] / dayCounts[i] : 0;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestDay = i;
      }
    }

    let currentSessionSeconds: number | null = null;
    if (details.player.online) {
      const activeSession = await Q.player.session
        .where({
          playerMinecraftUuid: uuid,
          sessionEnd: { $exists: false },
        })
        .orderBy("sessionStart", "desc")
        .first();

      if (activeSession) {
        currentSessionSeconds = Math.floor(
          (Date.now() - activeSession.sessionStart.getTime()) / 1000,
        );
      }
    }

    res.json({
      username: details.player.minecraftUsername,
      uuid,
      online: details.player.online,
      currentSessionSeconds,
      totalSeconds,
      currentStreak,
      mostActiveDay: totalSeconds > 0 ? dayNames[bestDay] : "N/A",
      days: dayMap,
    });
  }),
);

/**
 * GET /api/render/top?secret=...&category=...&item=...
 *
 * Returns top 3 players for a given Minecraft stat category + item.
 * Protected by puppeteer secret, not accessible to regular users.
 */
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

    const validCategories = [
      "minecraft:mined",
      "minecraft:killed",
      "minecraft:killed_by",
      "minecraft:crafted",
      "minecraft:used",
      "minecraft:broken",
      "minecraft:picked_up",
      "minecraft:dropped",
      "minecraft:custom",
    ];

    if (!validCategories.includes(category)) {
      res.status(400).json({ error: "Invalid stat category" });
      return;
    }

    const results = await Q.player.minecraft.stats.compareItem(
      item,
      [category],
      { limit: 3 },
    );

    // Format display title: "minecraft:zombie" + "minecraft:killed" → "Zombie Killed"
    const itemName = item
      .replace(/^minecraft:/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const categoryVerbs: Record<string, string> = {
      "minecraft:mined": "Mined",
      "minecraft:killed": "Killed",
      "minecraft:killed_by": "Deaths By",
      "minecraft:crafted": "Crafted",
      "minecraft:used": "Used",
      "minecraft:broken": "Broken",
      "minecraft:picked_up": "Picked Up",
      "minecraft:dropped": "Dropped",
      "minecraft:custom": "",
    };
    const verb = categoryVerbs[category] ?? category.replace(/^minecraft:/, "");
    const displayTitle = verb ? `${itemName} ${verb}` : itemName;

    res.json({
      category,
      item,
      displayTitle,
      players: results.map((r) => ({
        username: r.minecraftUsername,
        uuid: r.minecraftUuid,
        value: r.values[0] ?? 0,
      })),
    });
  }),
);

/**
 * GET /api/render/crypto-chart?secret=...&symbol=...&interval=...
 *
 * Returns token data and OHLCV price history for the chart render page.
 * Protected by puppeteer secret, not accessible to regular users.
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

    const token = await Q.crypto.token.find({ symbol: symbol.toUpperCase() });

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
      time: toUnixSeconds(s.recordedAt),
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

/**
 * GET /api/render/skin?uuid=...&pose=...
 *
 * Renders a player skin via the internal skin-api service and streams the
 * PNG back. Called from the puppeteer-targeted Render pages via <img> tags,
 * which cannot send custom headers, so the only gate is the loopback check
 * applied at the router level. The output is a public-ish render (no PII)
 * so omitting the puppeteer secret here is intentional.
 *
 * `pose` is optional; an unknown or missing pose falls back to a random
 * choice from KNOWN_POSES.
 */
router.get(
  "/skin",
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid, pose } = req.query;

    if (!uuid || typeof uuid !== "string") {
      res.status(400).json({ error: "uuid query param required" });
      return;
    }

    if (!MC_UUID_REGEX.test(uuid)) {
      res.status(400).json({ error: "Invalid uuid format" });
      return;
    }

    const requestedPose =
      typeof pose === "string" && KNOWN_POSE_SET.has(pose as KnownPose)
        ? (pose as KnownPose)
        : randomPose();

    let png: Uint8Array;
    try {
      png = await getSkinApiClient().render({
        pose: requestedPose,
        source: { uuid },
        options: MAX_QUALITY_RENDER,
      });
    } catch (error) {
      // Keep the <img> tag rendering something useful instead of triggering
      // the broken-image icon: bounce to mc-heads on any skin-api failure.
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `skin-api render failed (uuid=${uuid} pose=${requestedPose}): ${message}, falling back to mc-heads`,
      );
      res.redirect(
        302,
        `${MC_HEADS_FALLBACK_URL}/${uuid}/${MC_HEADS_FALLBACK_SIZE}`,
      );
      return;
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      `public, max-age=${SKIN_RENDER_CACHE_SECONDS}`,
    );
    res.setHeader("X-Skin-Pose", requestedPose);
    res.send(Buffer.from(png));
  }),
);

export default router;
