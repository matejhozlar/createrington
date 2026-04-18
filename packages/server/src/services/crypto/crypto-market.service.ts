import { Q } from "@/db";
import { CRYPTO_CONFIG } from "./crypto.config";
import {
  tickMemecoinPrice,
  tickStablecoinPrice,
  tickBluechipPrice,
  aggregateBluechipMetric,
  seedBluechipState,
  getBluechipState,
  applyPriceUpdate,
  recordTickSnapshot,
  refresh24hAverages,
  type PriceUpdate,
} from "./engine/price-engine";
import {
  generateMemecoin,
  generateIpoMemecoin,
  cleanupCrashedTokens,
} from "./memecoin/generator";
import {
  checkAndFillOrders,
  expireOrders,
  type OrderFillResult,
} from "./trading/order-manager";
import { checkAlerts, type TriggeredAlert } from "./alerts/alert-manager";
import { takeDailySnapshots } from "./analytics/portfolio-tracker";
import { getService } from "@/services";
import { Services } from "../container";
import type { WebSocketService } from "../websocket";
import { SocketEvent } from "@createrington/shared/socket";
import { RoomManager } from "../websocket/room-manager";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import {
  sendNewListingNotification,
  sendCrashNotification,
  sendWeeklyMarketReport,
  sendMarketEventNotification,
  sendIpoAnnouncementNotification,
  sendPriceAlertDMs,
} from "./notifications";
import {
  rollForEvents,
  restoreActiveEvents,
  getActiveEventsInMemory,
  triggerEvent as triggerMarketEvent,
  type ActiveEvent,
} from "./events/event-engine";
import {
  EVENT_DEFINITIONS,
  type MarketEventType,
} from "./events/event-definitions";
import {
  aggregateDailySnapshots,
  aggregateHourlySnapshots,
  aggregateMinuteSnapshots,
  aggregateWeeklySnapshots,
} from "./aggregation";
import { MarketCaches } from "./market-caches";
import {
  delistToken as performDelistToken,
  processExpiredSeasonalTokens,
} from "./lifecycle/seasonal";
import { transitionEndedIpos } from "./lifecycle/ipo";

/**
 * Crypto Market Service
 *
 * Orchestrates the in-game cryptocurrency market:
 * - Runs periodic price tickers for memecoins, stablecoins, and blue-chips
 * - Aggregates tick-level snapshots into minute OHLCV candles
 * - Broadcasts real-time price updates to WebSocket subscribers
 * - Maintains in-memory caches for 24h price change% and trade volume
 * - Periodically refreshes demand-pressure and mean-reversion state in the price engine
 * - Checks and fills pending limit/stop-loss/take-profit orders after each tick
 * - Expires stale pending orders on a 5-minute cycle
 * - Cleans up crashed tokens after a configurable grace period
 * - Spawns new memecoins from the catalog with Discord notifications
 * - Manages IPO lifecycle: schedules IPO spawns, skips IPO tokens from price ticking,
 *   and transitions ended IPOs into normal trading with result notifications
 *
 * NOTE: Requires DATABASE and WEBSOCKET_SERVICE to be ready before initialization
 */
export class CryptoMarketService {
  private memecoinInterval: ReturnType<typeof setInterval> | null = null;
  private stablecoinInterval: ReturnType<typeof setInterval> | null = null;
  private bluechipInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private minuteAggregationInterval: ReturnType<typeof setInterval> | null =
    null;
  private hourlyAggregationInterval: ReturnType<typeof setInterval> | null =
    null;
  private dailyAggregationInterval: ReturnType<typeof setInterval> | null =
    null;
  private weeklyAggregationInterval: ReturnType<typeof setInterval> | null =
    null;
  private orderExpiryInterval: ReturnType<typeof setInterval> | null = null;
  private eventRollInterval: ReturnType<typeof setInterval> | null = null;
  private seasonalCheckInterval: ReturnType<typeof setInterval> | null = null;
  private ipoCheckInterval: ReturnType<typeof setInterval> | null = null;
  private ipoSpawnInterval: ReturnType<typeof setInterval> | null = null;
  private portfolioSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
  private weeklyReportTimeout: ReturnType<typeof setTimeout> | null = null;
  private wsService: WebSocketService | null = null;

  private readonly caches = new MarketCaches();

  /**
   * Initializes the crypto market service.
   *
   * Ensures the treasury row exists, loads active tokens, seeds the 24h
   * price/volume caches and engine averages, then starts all ticker intervals.
   *
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    logger.info("CryptoMarketService initializing...");

    const treasury = await Q.crypto.treasury.where({}).first();
    if (!treasury) {
      await Q.crypto.treasury.create({
        totalCollected: "0",
        totalBurned: "0",
      });
    }

    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    logger.info(`Loaded ${tokens.length} active crypto tokens`);

    // WebSocket service may not be ready yet; retry on first tick
    try {
      this.wsService = await getService(Services.WEBSOCKET_SERVICE);
    } catch {
      logger.warn(
        "WebSocket service not available during crypto init, will retry on first tick",
      );
    }

    await this.caches.refreshPrices();
    await this.caches.refreshVolumes();
    await refresh24hAverages();

    // Restore blue-chip metric state from token metadata (restart resilience)
    const bluechips = tokens.filter((t) => t.category === "blue_chip");
    for (const token of bluechips) {
      const meta = token.metadata as Record<string, unknown> | null;
      if (meta) {
        seedBluechipState(
          token.symbol,
          meta.previousMetric as number | undefined,
          meta.baseline as number | undefined,
        );
      }
    }

    await restoreActiveEvents();

    this.startMemecoinTicker();
    this.startStablecoinTicker();
    this.startBluechipTicker();
    this.startCleanupJob();
    this.startMinuteAggregation();
    this.startHourlyAggregation();
    this.startDailyAggregation();
    this.startWeeklyAggregation();
    this.startOrderExpiryJob();
    this.startEventRoller();
    this.startSeasonalTokenCheck();
    this.startIpoTransitionCheck();
    this.startIpoSpawnScheduler();
    this.schedulePortfolioSnapshot();
    this.scheduleWeeklyReport();

    logger.info("CryptoMarketService initialized");
  }

  /** Clears all ticker intervals and releases resources */
  async shutdown(): Promise<void> {
    if (this.memecoinInterval) clearInterval(this.memecoinInterval);
    if (this.stablecoinInterval) clearInterval(this.stablecoinInterval);
    if (this.bluechipInterval) clearInterval(this.bluechipInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.minuteAggregationInterval)
      clearInterval(this.minuteAggregationInterval);
    if (this.hourlyAggregationInterval)
      clearInterval(this.hourlyAggregationInterval);
    if (this.dailyAggregationInterval)
      clearInterval(this.dailyAggregationInterval);
    if (this.weeklyAggregationInterval)
      clearInterval(this.weeklyAggregationInterval);
    if (this.orderExpiryInterval) clearInterval(this.orderExpiryInterval);
    if (this.eventRollInterval) clearInterval(this.eventRollInterval);
    if (this.seasonalCheckInterval) clearInterval(this.seasonalCheckInterval);
    if (this.ipoCheckInterval) clearInterval(this.ipoCheckInterval);
    if (this.ipoSpawnInterval) clearInterval(this.ipoSpawnInterval);
    if (this.portfolioSnapshotTimeout)
      clearTimeout(this.portfolioSnapshotTimeout);
    if (this.weeklyReportTimeout) clearTimeout(this.weeklyReportTimeout);

    logger.info("CryptoMarketService shutdown complete");
  }

  /** @private Starts the memecoin price ticker with an immediate first tick */
  private startMemecoinTicker(): void {
    this.memecoinInterval = setInterval(async () => {
      try {
        await this.tickMemecoins();
      } catch (err) {
        logger.error("Memecoin tick failed:", err);
      }
    }, CRYPTO_CONFIG.MEMECOIN_TICK_INTERVAL_MS);

    this.tickMemecoins().catch((err) =>
      logger.error("Initial memecoin tick failed:", err),
    );
  }

  /** @private Starts the stablecoin price ticker */
  private startStablecoinTicker(): void {
    this.stablecoinInterval = setInterval(async () => {
      try {
        await this.tickStablecoins();
      } catch (err) {
        logger.error("Stablecoin tick failed:", err);
      }
    }, CRYPTO_CONFIG.STABLECOIN_TICK_INTERVAL_MS);
  }

  /** @private Starts the blue-chip price ticker (hourly, metric-driven) */
  private startBluechipTicker(): void {
    this.bluechipInterval = setInterval(async () => {
      try {
        await this.tickBluechips();
      } catch (err) {
        logger.error("Blue-chip tick failed:", err);
      }
    }, CRYPTO_CONFIG.BLUECHIP_TICK_INTERVAL_MS);
  }

  /** @private Removes crashed tokens and their holdings/snapshots every 30 minutes */
  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(
      async () => {
        try {
          const cleaned = await cleanupCrashedTokens();
          if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} crashed memecoins`);
          }
        } catch (err) {
          logger.error("Crashed token cleanup failed:", err);
        }
      },
      30 * 60 * 1000,
    );
  }

  /**
   * Aggregates tick snapshots into minute OHLCV candles every 5 minutes.
   * Also refreshes the 24h price/volume caches and engine mean-reversion averages.
   * @private
   */
  private startMinuteAggregation(): void {
    this.minuteAggregationInterval = setInterval(
      async () => {
        try {
          await aggregateMinuteSnapshots();
          await this.caches.refreshPrices();
          await this.caches.refreshVolumes();
          await refresh24hAverages();
        } catch (err) {
          logger.error("Minute aggregation failed:", err);
        }
      },
      5 * 60 * 1000,
    );
  }

  /** @private Aggregates minute → hourly candles every 15 minutes */
  private startHourlyAggregation(): void {
    this.hourlyAggregationInterval = setInterval(
      async () => {
        try {
          await aggregateHourlySnapshots();
        } catch (err) {
          logger.error("Hourly aggregation failed:", err);
        }
      },
      15 * 60 * 1000,
    );
  }

  /** @private Aggregates hourly → daily candles every hour */
  private startDailyAggregation(): void {
    this.dailyAggregationInterval = setInterval(
      async () => {
        try {
          await aggregateDailySnapshots();
        } catch (err) {
          logger.error("Daily aggregation failed:", err);
        }
      },
      60 * 60 * 1000,
    );
  }

  /** @private Aggregates daily → weekly candles every 6 hours */
  private startWeeklyAggregation(): void {
    this.weeklyAggregationInterval = setInterval(
      async () => {
        try {
          await aggregateWeeklySnapshots();
        } catch (err) {
          logger.error("Weekly aggregation failed:", err);
        }
      },
      6 * 60 * 60 * 1000,
    );
  }

  /**
   * Calculates new prices for all active memecoins, broadcasts updates,
   * sends crash notifications, and checks pending orders for fills.
   * @private
   */
  private async tickMemecoins(): Promise<void> {
    const memecoins = await Q.crypto.token
      .where({ category: "memecoin", isCrashed: false })
      .all();

    if (memecoins.length === 0) return;

    const updates: PriceUpdate[] = [];
    const now = new Date();

    for (const token of memecoins) {
      // Skip tokens currently in their IPO window — price is fixed
      if (token.ipoEndsAt && token.ipoEndsAt > now) continue;

      const update = tickMemecoinPrice(token);
      await applyPriceUpdate(update);
      await recordTickSnapshot(update);
      updates.push(update);

      if (update.isCrashed) {
        // Notify Discord and evaluate any crash-related achievements for holders
        sendCrashNotification(token.name, token.symbol, update.oldPrice).catch(
          (err) => logger.error("Failed to send crash notification:", err),
        );
        getService(Services.ACHIEVEMENT_SERVICE)
          .then((svc) => svc.evaluateCrashAchievements(token.id))
          .catch((err) =>
            logger.error("Failed to evaluate crash achievements:", err),
          );
      }
    }

    await this.broadcastPriceUpdates(updates);

    const updatedTokens = await Promise.all(
      updates.map((u) => Q.crypto.token.get({ id: u.tokenId })),
    );
    const fillResults = await checkAndFillOrders(updatedTokens);
    this.notifyOrderFills(fillResults);

    const tokenPrices = new Map(
      updates.map((u) => [u.tokenId, { price: u.newPrice, symbol: u.symbol }]),
    );
    const triggered = await checkAlerts(tokenPrices);
    this.notifyTriggeredAlerts(triggered);
  }

  /**
   * Recalculates stablecoin prices based on the current active player count
   * and broadcasts updates.
   * @private
   */
  private async tickStablecoins(): Promise<void> {
    const stablecoins = await Q.crypto.token
      .where({ category: "stable" })
      .all();

    if (stablecoins.length === 0) return;

    const activePlayers = await Q.player.where({ online: true }).count();

    const updates: PriceUpdate[] = [];

    for (const token of stablecoins) {
      const update = tickStablecoinPrice(token, activePlayers);
      await applyPriceUpdate(update);
      await recordTickSnapshot(update);
      updates.push(update);
    }

    await this.broadcastPriceUpdates(updates);
  }

  /**
   * Recalculates blue-chip prices based on aggregated server metrics (blocks, kills,
   * achievements), persists metric state in token metadata, and broadcasts updates.
   * @private
   */
  private async tickBluechips(): Promise<void> {
    const bluechips = await Q.crypto.token
      .where({ category: "blue_chip" })
      .all();

    if (bluechips.length === 0) return;

    const updates: PriceUpdate[] = [];

    for (const token of bluechips) {
      const metricConfig = CRYPTO_CONFIG.BLUECHIP_METRICS[token.symbol];
      if (!metricConfig) {
        logger.warn(
          `No metric config for blue-chip token ${token.symbol}, skipping`,
        );
        continue;
      }

      const currentMetric = await aggregateBluechipMetric(metricConfig);
      const update = tickBluechipPrice(token, currentMetric);
      await applyPriceUpdate(update);
      await recordTickSnapshot(update);
      updates.push(update);

      // Persist metric state in token metadata for restart resilience
      const state = getBluechipState(token.symbol);
      await Q.crypto.token.update(
        { id: token.id },
        {
          metadata: {
            ...((token.metadata as Record<string, unknown>) ?? {}),
            previousMetric: state.previousMetric,
            baseline: state.baseline,
          },
        },
      );
    }

    await this.broadcastPriceUpdates(updates);

    if (updates.length > 0) {
      const updatedTokens = await Promise.all(
        updates.map((u) => Q.crypto.token.get({ id: u.tokenId })),
      );
      const fillResults = await checkAndFillOrders(updatedTokens);
      this.notifyOrderFills(fillResults);
    }
  }

  /**
   * Computes the 24h price change percentage for a token.
   * @param tokenId - Token to look up in the 24h price cache
   * @param currentPrice - Current price as a decimal string
   * @returns Percentage change (e.g. 12.5 for +12.5%), or 0 if no baseline exists
   */
  get24hChange(tokenId: number, currentPrice: string): number {
    return this.caches.getChange(tokenId, currentPrice);
  }

  /**
   * Sends price update payloads to all WebSocket crypto market subscribers.
   * Includes a market overview snapshot so clients never need to poll for it.
   * Lazily resolves the WebSocket service if it wasn't available at init time.
   * @private
   * @param updates - Price updates from the latest tick to broadcast
   */
  private async broadcastPriceUpdates(updates: PriceUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    if (!this.wsService) {
      try {
        this.wsService = await getService(Services.WEBSOCKET_SERVICE);
      } catch {
        return;
      }
    }

    const pricePayloads = await Promise.all(
      updates.map(async (u) => {
        const token = await Q.crypto.token.get({ id: u.tokenId });
        return {
          tokenId: u.tokenId,
          symbol: u.symbol,
          price: u.newPrice,
          change24h: this.caches.getChange(u.tokenId, u.newPrice),
          volume24h: String(this.caches.getTokenVolume(u.tokenId)),
          availableSupply: String(token.availableSupply),
          isCrashed: u.isCrashed,
        };
      }),
    );

    const overview = await this.buildMarketOverview();

    this.wsService!.broadcastToRoom(
      RoomManager.getCryptoMarketRoom(),
      SocketEvent.UPDATE_CRYPTO_PRICES,
      { prices: pricePayloads, overview },
    );
  }

  /**
   * Builds a market overview snapshot from in-memory caches and active tokens.
   * Used in both price broadcasts and initial snapshots.
   */
  async buildMarketOverview(): Promise<{
    totalMarketCap: string;
    totalVolume24h: string;
    topGainer: { symbol: string; change24h: number } | null;
    topLoser: { symbol: string; change24h: number } | null;
  }> {
    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    const activeTokens = tokens.filter((t) => !t.delistedAt);

    const totalMarketCap = activeTokens.reduce(
      (sum, t) =>
        sum + Number(t.price) * Number(t.totalSupply - t.availableSupply),
      0,
    );

    const { topGainer, topLoser } = await this.getTopMovers();

    return {
      totalMarketCap: totalMarketCap.toFixed(2),
      totalVolume24h: String(this.caches.getTotalVolume()),
      topGainer,
      topLoser,
    };
  }

  /**
   * Builds a full price snapshot for all active tokens.
   * Used when a client first subscribes to the crypto market room.
   */
  async buildFullPriceSnapshot(): Promise<
    Array<{
      tokenId: number;
      symbol: string;
      price: string;
      change24h: number;
      volume24h: string;
      availableSupply: string;
      isCrashed: boolean;
    }>
  > {
    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    const activeTokens = tokens.filter((t) => !t.delistedAt);

    return activeTokens.map((t) => ({
      tokenId: t.id,
      symbol: t.symbol,
      price: t.price,
      change24h: this.caches.getChange(t.id, t.price),
      volume24h: String(this.caches.getTokenVolume(t.id)),
      availableSupply: String(t.availableSupply),
      isCrashed: t.isCrashed,
    }));
  }

  /** @private Expires stale pending orders every 5 minutes */
  private startOrderExpiryJob(): void {
    this.orderExpiryInterval = setInterval(
      async () => {
        try {
          const expired = await expireOrders();
          if (expired > 0) {
            logger.info(`Expired ${expired} crypto orders`);
          }
        } catch (err) {
          logger.error("Order expiry job failed:", err);
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Broadcasts order fill notifications to the crypto market room.
   * Clients filter incoming events by their own playerUuid.
   * @private
   * @param results - Order fill results from the latest tick
   */
  private notifyOrderFills(results: OrderFillResult[]): void {
    if (results.length === 0 || !this.wsService) return;

    for (const result of results) {
      logger.info(
        `Order ${result.orderId} filled: ${result.type} ${result.amount} ${result.symbol} @ $${result.filledPrice}`,
      );

      this.wsService.broadcastToRoom(
        RoomManager.getCryptoMarketRoom(),
        SocketEvent.UPDATE_CRYPTO_ORDER,
        {
          orderId: result.orderId,
          playerUuid: result.playerUuid,
          status: "filled" as const,
          filledPrice: result.filledPrice,
          filledAt: new Date().toISOString(),
        },
      );
    }
  }

  /**
   * Schedules the daily portfolio snapshot at the configured hour.
   * Reschedules itself for the next day after completing.
   * @private
   */
  private schedulePortfolioSnapshot(): void {
    const now = new Date();
    const target = new Date(now);
    target.setHours(CRYPTO_CONFIG.PORTFOLIO_SNAPSHOT_HOUR, 0, 0, 0);

    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delayMs = target.getTime() - now.getTime();
    logger.info(
      `Next portfolio snapshot scheduled in ${Math.round(delayMs / 60_000)} minutes`,
    );

    this.portfolioSnapshotTimeout = setTimeout(async () => {
      try {
        const count = await takeDailySnapshots();
        logger.info(`Took ${count} portfolio snapshots`);
      } catch (err) {
        logger.error("Portfolio snapshot failed:", err);
      }

      // Daily snapshot is the trigger for Diamond Hands — holdings must have
      // existed for 30+ days, so this check is only meaningful once per day
      try {
        const achievementSvc = await getService(Services.ACHIEVEMENT_SERVICE);
        await achievementSvc.evaluateDiamondHands();
      } catch (err) {
        logger.error("Diamond Hands evaluation failed:", err);
      }

      this.schedulePortfolioSnapshot();
    }, delayMs);
  }

  /**
   * Schedules the weekly market report for Sunday at 18:00.
   * Reschedules itself for the next week after completing.
   * @private
   */
  private scheduleWeeklyReport(): void {
    const now = new Date();
    const target = new Date(now);
    // Sunday = 0
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    target.setDate(now.getDate() + daysUntilSunday);
    target.setHours(18, 0, 0, 0);

    // If the computed target is in the past (e.g. it's already past 18:00 on Sunday), skip to next week
    if (target <= now) {
      target.setDate(target.getDate() + 7);
    }

    const delayMs = target.getTime() - now.getTime();
    logger.info(
      `Next weekly market report scheduled in ${Math.round(delayMs / 3_600_000)} hours`,
    );

    this.weeklyReportTimeout = setTimeout(async () => {
      try {
        await sendWeeklyMarketReport();
      } catch (err) {
        logger.error("Weekly market report failed:", err);
      }
      this.scheduleWeeklyReport();
    }, delayMs);
  }

  /**
   * Sends WebSocket notifications to the crypto market room for triggered price alerts.
   * Clients filter incoming events by their own playerUuid.
   * @private
   * @param alerts - Price alerts that crossed their target threshold in the latest tick
   */
  private notifyTriggeredAlerts(alerts: TriggeredAlert[]): void {
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      logger.info(
        `Price alert triggered: ${alert.tokenSymbol} ${alert.direction} $${alert.targetPrice} (now $${alert.currentPrice})`,
      );

      // Broadcast alert trigger via WebSocket to the specific user
      if (this.wsService) {
        this.wsService.broadcastToRoom(
          RoomManager.getCryptoMarketRoom(),
          SocketEvent.CRYPTO_NEWS,
          {
            type: "price_alert",
            playerUuid: alert.playerUuid,
            tokenSymbol: alert.tokenSymbol,
            direction: alert.direction,
            targetPrice: alert.targetPrice,
            currentPrice: alert.currentPrice,
          },
        );
      }
    }

    // Send Discord DMs (fire-and-forget, does not block the tick cycle)
    sendPriceAlertDMs(alerts).catch((err) => {
      logger.error("Failed to send price alert DMs:", err);
    });
  }

  /** @private Rolls for random market events every hour */
  private startEventRoller(): void {
    this.eventRollInterval = setInterval(async () => {
      try {
        const newEvents = await rollForEvents();
        for (const event of newEvents) {
          this.broadcastMarketEvent(event);
          sendMarketEventNotification(event).catch((err) =>
            logger.error("Failed to send event notification:", err),
          );
        }
      } catch (err) {
        logger.error("Event roll failed:", err);
      }
    }, CRYPTO_CONFIG.EVENT_ROLL_INTERVAL_MS);
  }

  /** @private Broadcasts a market event to WebSocket subscribers */
  private broadcastMarketEvent(event: ActiveEvent): void {
    if (!this.wsService) return;

    this.wsService.broadcastToRoom(
      RoomManager.getCryptoMarketRoom(),
      SocketEvent.CRYPTO_MARKET_EVENT,
      {
        id: event.eventId,
        type: event.type,
        title:
          EVENT_DEFINITIONS[event.type as keyof typeof EVENT_DEFINITIONS]
            ?.name ?? event.type,
        tokenId: event.tokenId,
        tokenSymbol: event.tokenSymbol,
        severity:
          EVENT_DEFINITIONS[event.type as keyof typeof EVENT_DEFINITIONS]
            ?.severity ?? "info",
        activeUntil: event.activeUntil?.toISOString() ?? null,
      },
    );
  }

  /** @private Checks for expired seasonal tokens every 10 minutes */
  private startSeasonalTokenCheck(): void {
    this.seasonalCheckInterval = setInterval(
      async () => {
        try {
          await processExpiredSeasonalTokens();
        } catch (err) {
          logger.error("Seasonal token check failed:", err);
        }
      },
      10 * 60 * 1000,
    );
  }

  /**
   * Delists a token: auto-sells all player holdings at current price
   * and marks the token as delisted.
   *
   * @param tokenId - ID of the token to delist
   */
  async delistToken(tokenId: number): Promise<void> {
    return performDelistToken(tokenId);
  }

  /** @private Checks for ended IPOs every 30 seconds and transitions them to normal trading */
  private startIpoTransitionCheck(): void {
    this.ipoCheckInterval = setInterval(async () => {
      try {
        await transitionEndedIpos();
      } catch (err) {
        logger.error("IPO transition check failed:", err);
      }
    }, CRYPTO_CONFIG.IPO_CHECK_INTERVAL_MS);
  }

  /** @private Automatically spawns a new IPO memecoin on a recurring schedule */
  private startIpoSpawnScheduler(): void {
    // Immediate check on startup so deploys don't indefinitely delay spawns
    this.trySpawnIpo().catch((err) =>
      logger.error("Initial IPO spawn check failed:", err),
    );

    this.ipoSpawnInterval = setInterval(async () => {
      await this.trySpawnIpo();
    }, CRYPTO_CONFIG.IPO_SPAWN_INTERVAL_MS);
  }

  /** @private Attempts to spawn an IPO memecoin if none is active */
  private async trySpawnIpo(): Promise<void> {
    try {
      const activeIpo = await this.getActiveIpo();
      if (!activeIpo) {
        await this.spawnIpoMemecoin();
      }
    } catch (err) {
      logger.error("IPO spawn scheduler failed:", err);
    }
  }

  /**
   * Generates a new random memecoin from the catalog and sends a Discord
   * listing notification on success.
   * @returns The newly created token, or null if the catalog is exhausted
   */
  async spawnMemecoin(): Promise<CryptoToken | null> {
    const token = await generateMemecoin();

    if (token) {
      sendNewListingNotification(
        token.name,
        token.symbol,
        token.price,
        String(token.totalSupply),
      ).catch((err) =>
        logger.error("Failed to send new listing notification:", err),
      );
    }

    return token;
  }

  /**
   * Generates a new memecoin with an IPO phase and sends announcement notification.
   * @returns The newly created IPO token, or null if the catalog is exhausted
   */
  async spawnIpoMemecoin(): Promise<CryptoToken | null> {
    const token = await generateIpoMemecoin();

    if (token) {
      sendIpoAnnouncementNotification(
        token.name,
        token.symbol,
        token.ipoPrice!,
        String(token.totalSupply),
        token.ipoEndsAt!,
      ).catch((err) =>
        logger.error("Failed to send IPO announcement notification:", err),
      );
    }

    return token;
  }

  /**
   * Returns the currently active IPO token, if any.
   * @returns The token in IPO phase, or null if no IPO is active
   */
  async getActiveIpo(): Promise<CryptoToken | null> {
    const memecoins = await Q.crypto.token
      .where({ category: "memecoin", isCrashed: false })
      .all();

    const now = new Date();
    return memecoins.find((t) => t.ipoEndsAt && t.ipoEndsAt > now) ?? null;
  }

  /**
   * Returns all active (non-crashed) tokens.
   * @returns Array of active crypto tokens
   */
  async getActiveTokens(): Promise<CryptoToken[]> {
    return Q.crypto.token.where({ isCrashed: false }).all();
  }

  /** Returns the currently active market events */
  getActiveEvents(): ActiveEvent[] {
    return getActiveEventsInMemory();
  }

  /** Returns the total 24h trading volume across all tokens */
  getTotalVolume24h(): bigint {
    return this.caches.getTotalVolume();
  }

  /** Returns the 24h trading volume for a specific token */
  getTokenVolume24h(tokenId: number): bigint {
    return this.caches.getTokenVolume(tokenId);
  }

  /**
   * Returns the top gainer and top loser by 24h price change.
   * Only considers active, non-crashed, non-IPO tokens.
   */
  async getTopMovers(): Promise<{
    topGainer: { symbol: string; change24h: number } | null;
    topLoser: { symbol: string; change24h: number } | null;
  }> {
    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    const now = new Date();

    let topGainer: { symbol: string; change24h: number } | null = null;
    let topLoser: { symbol: string; change24h: number } | null = null;

    for (const token of tokens) {
      if (token.delistedAt) continue;
      if (token.ipoEndsAt && token.ipoEndsAt > now) continue;

      const change = this.caches.getChange(token.id, token.price);
      if (change === 0) continue;

      if (!topGainer || change > topGainer.change24h) {
        topGainer = { symbol: token.symbol, change24h: change };
      }
      if (!topLoser || change < topLoser.change24h) {
        topLoser = { symbol: token.symbol, change24h: change };
      }
    }

    return { topGainer, topLoser };
  }

  /**
   * Manually triggers a market event (admin action).
   *
   * @param eventType - The type of market event to trigger
   * @param tokenId - Optional token to scope the event to a specific asset
   * @returns The activated event, or null if the event type could not be triggered
   */
  async triggerEvent(
    eventType: MarketEventType,
    tokenId?: number,
  ): Promise<ActiveEvent | null> {
    const event = await triggerMarketEvent(eventType, tokenId);
    if (event) {
      this.broadcastMarketEvent(event);
      sendMarketEventNotification(event).catch((err) =>
        logger.error("Failed to send event notification:", err),
      );
    }
    return event;
  }

  /**
   * Creates a new token (used by admin for seasonal/event tokens).
   * Sends a Discord new-listing notification on success.
   *
   * @param params - Token creation parameters
   * @param params.name - Display name of the token
   * @param params.symbol - Unique ticker symbol (e.g. "DOGE")
   * @param params.description - Optional description shown in the market UI
   * @param params.category - Token category controlling price engine behavior
   * @param params.totalSupply - Total number of units to mint
   * @param params.price - Initial price as a decimal string
   * @param params.floorPrice - Optional minimum price floor
   * @param params.delistedAt - Optional date after which the token is auto-delisted
   * @returns The newly created token record
   */
  async createToken(params: {
    name: string;
    symbol: string;
    description?: string;
    category: "stable" | "blue_chip" | "memecoin" | "seasonal";
    totalSupply: bigint;
    price: string;
    floorPrice?: string;
    delistedAt?: Date;
  }): Promise<CryptoToken> {
    const existing = await Q.crypto.token.find({ symbol: params.symbol });
    if (existing) {
      throw new Error(`Token with symbol ${params.symbol} already exists`);
    }

    if (params.category === "memecoin") {
      const activeMemecoins = await Q.crypto.token
        .where({
          category: "memecoin",
          isCrashed: false,
          delistedAt: { $exists: false },
        })
        .all();
      if (activeMemecoins.length >= CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE) {
        throw new Error(
          `Maximum active memecoins (${CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE}) reached`,
        );
      }
    }

    const token = await Q.crypto.token.createAndReturn({
      name: params.name,
      symbol: params.symbol,
      description: params.description ?? null,
      category: params.category,
      totalSupply: params.totalSupply,
      availableSupply: params.totalSupply,
      price: params.price,
      floorPrice: params.floorPrice ?? null,
      delistedAt: params.delistedAt ?? null,
      metadata: {},
    });

    sendNewListingNotification(
      token.name,
      token.symbol,
      token.price,
      String(token.totalSupply),
    ).catch((err) =>
      logger.error("Failed to send new listing notification:", err),
    );

    return token;
  }
}
