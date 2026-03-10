import { Q } from "@/db";
import { CRYPTO_CONFIG } from "./crypto.config";
import {
  tickMemecoinPrice,
  tickStablecoinPrice,
  applyPriceUpdate,
  recordTickSnapshot,
  type PriceUpdate,
} from "./engine/price-engine";
import { generateMemecoin, cleanupCrashedTokens } from "./memecoin/generator";
import { getService } from "@/services";
import { Services } from "../container";
import type { WebSocketService } from "../websocket";
import { SocketEvent } from "@createrington/shared/socket";
import { RoomManager } from "../websocket/room-manager";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import { sendNewListingNotification, sendCrashNotification } from "./notifications";

/**
 * Crypto Market Service
 *
 * Orchestrates the in-game cryptocurrency market:
 * - Runs periodic price tickers for memecoins and stablecoins
 * - Aggregates tick-level snapshots into minute OHLCV candles
 * - Broadcasts real-time price updates to WebSocket subscribers
 * - Cleans up crashed tokens after a configurable grace period
 * - Spawns new memecoins from the catalog with Discord notifications
 *
 * NOTE: Requires DATABASE and WEBSOCKET_SERVICE to be ready before initialization
 */
export class CryptoMarketService {
  private memecoinInterval: ReturnType<typeof setInterval> | null = null;
  private stablecoinInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private minuteAggregationInterval: ReturnType<typeof setInterval> | null =
    null;
  private wsService: WebSocketService | null = null;

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /** Initializes treasury, loads active tokens, and starts all ticker intervals */
  async initialize(): Promise<void> {
    logger.info("CryptoMarketService initializing...");

    // Ensure treasury row exists
    const treasury = await Q.crypto.treasury.where({}).first();
    if (!treasury) {
      await Q.crypto.treasury.create({
        totalCollected: "0",
        totalBurned: "0",
      });
    }

    // Load active tokens to verify DB state
    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    logger.info(`Loaded ${tokens.length} active crypto tokens`);

    // Try to get WebSocket service (may not be ready yet)
    try {
      this.wsService = await getService(Services.WEBSOCKET_SERVICE);
    } catch {
      logger.warn(
        "WebSocket service not available during crypto init, will retry on first tick",
      );
    }

    // Start price engine intervals
    this.startMemecoinTicker();
    this.startStablecoinTicker();
    this.startCleanupJob();
    this.startMinuteAggregation();

    logger.info("CryptoMarketService initialized");
  }

  /** Clears all ticker intervals */
  async shutdown(): Promise<void> {
    if (this.memecoinInterval) clearInterval(this.memecoinInterval);
    if (this.stablecoinInterval) clearInterval(this.stablecoinInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.minuteAggregationInterval)
      clearInterval(this.minuteAggregationInterval);

    logger.info("CryptoMarketService shutdown complete");
  }

  // ==========================================================================
  // TICKER INTERVALS
  // ==========================================================================

  /** @private Starts the memecoin price ticker with an immediate first tick */
  private startMemecoinTicker(): void {
    this.memecoinInterval = setInterval(async () => {
      try {
        await this.tickMemecoins();
      } catch (err) {
        logger.error("Memecoin tick failed:", err);
      }
    }, CRYPTO_CONFIG.MEMECOIN_TICK_INTERVAL_MS);

    // Run initial tick
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

  /** @private Aggregates tick snapshots into minute OHLCV candles every 5 minutes */
  private startMinuteAggregation(): void {
    this.minuteAggregationInterval = setInterval(
      async () => {
        try {
          await this.aggregateMinuteSnapshots();
        } catch (err) {
          logger.error("Minute aggregation failed:", err);
        }
      },
      5 * 60 * 1000,
    );
  }

  // ==========================================================================
  // PRICE TICKING
  // ==========================================================================

  /** @private Calculates new prices for all active memecoins and broadcasts updates */
  private async tickMemecoins(): Promise<void> {
    const memecoins = await Q.crypto.token
      .where({ category: "memecoin", isCrashed: false })
      .all();

    if (memecoins.length === 0) return;

    const updates: PriceUpdate[] = [];

    for (const token of memecoins) {
      const update = tickMemecoinPrice(token);
      await applyPriceUpdate(update);
      await recordTickSnapshot(update);
      updates.push(update);

      // Send Discord crash notification
      if (update.isCrashed) {
        sendCrashNotification(token.name, token.symbol, update.oldPrice).catch(
          (err) => logger.error("Failed to send crash notification:", err),
        );
      }
    }

    // Broadcast price updates via WebSocket
    await this.broadcastPriceUpdates(updates);
  }

  /** @private Recalculates stablecoin prices based on active player count */
  private async tickStablecoins(): Promise<void> {
    const stablecoins = await Q.crypto.token
      .where({ category: "stable" })
      .all();

    if (stablecoins.length === 0) return;

    // Get active player count for stablecoin pricing
    const activePlayers = await Q.player
      .where({ online: true })
      .count();

    const updates: PriceUpdate[] = [];

    for (const token of stablecoins) {
      const update = tickStablecoinPrice(token, activePlayers);
      await applyPriceUpdate(update);
      await recordTickSnapshot(update);
      updates.push(update);
    }

    await this.broadcastPriceUpdates(updates);
  }

  // ==========================================================================
  // BROADCASTING
  // ==========================================================================

  /** @private Sends price update payloads to all WebSocket crypto market subscribers */
  private async broadcastPriceUpdates(updates: PriceUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    if (!this.wsService) {
      try {
        this.wsService = await getService(Services.WEBSOCKET_SERVICE);
      } catch {
        return;
      }
    }

    // Fetch 24h-ago prices for change calculation
    const pricePayloads = await Promise.all(
      updates.map(async (u) => {
        const token = await Q.crypto.token.get({ id: u.tokenId });
        return {
          tokenId: u.tokenId,
          symbol: u.symbol,
          price: u.newPrice,
          change24h: 0, // Will be calculated properly once we have history
          volume24h: "0",
          availableSupply: String(token.availableSupply),
          isCrashed: u.isCrashed,
        };
      }),
    );

    this.wsService!.broadcastToRoom(
      RoomManager.getCryptoMarketRoom(),
      SocketEvent.UPDATE_CRYPTO_PRICES,
      pricePayloads,
    );
  }

  // ==========================================================================
  // AGGREGATION
  // ==========================================================================

  /**
   * Rolls up tick-level snapshots into minute OHLCV candles and prunes old ticks
   * @private
   */
  private async aggregateMinuteSnapshots(): Promise<void> {
    const tokens = await Q.crypto.token.where({}).all();
    const now = new Date();
    // Round to current minute
    now.setSeconds(0, 0);
    const minuteStart = new Date(now.getTime() - 60_000);

    for (const token of tokens) {
      const ticks = await Q.crypto.price.snapshot
        .where({
          tokenId: token.id,
          interval: "tick",
        })
        .all();

      // Filter ticks within the last minute window
      const relevantTicks = ticks.filter(
        (t) =>
          t.recordedAt >= minuteStart && t.recordedAt < now,
      );

      if (relevantTicks.length === 0) continue;

      const open = relevantTicks[0].openPrice;
      const close = relevantTicks[relevantTicks.length - 1].closePrice;
      const high = relevantTicks.reduce(
        (max, t) =>
          Number(t.highPrice) > Number(max) ? t.highPrice : max,
        relevantTicks[0].highPrice,
      );
      const low = relevantTicks.reduce(
        (min, t) =>
          Number(t.lowPrice) < Number(min) ? t.lowPrice : min,
        relevantTicks[0].lowPrice,
      );
      const volume = relevantTicks.reduce(
        (sum, t) => sum + t.volume,
        0n,
      );

      try {
        await Q.crypto.price.snapshot.create({
          tokenId: token.id,
          interval: "minute",
          openPrice: open,
          highPrice: high,
          lowPrice: low,
          closePrice: close,
          volume,
          recordedAt: minuteStart,
        });
      } catch {
        // Ignore duplicate (unique constraint on token+interval+recordedAt)
      }
    }

    // Prune old tick snapshots (older than 2 hours)
    const tickCutoff = new Date(
      Date.now() - CRYPTO_CONFIG.RETENTION.TICK * 1000,
    );
    const oldTicks = await Q.crypto.price.snapshot
      .where({ interval: "tick" })
      .all();

    for (const tick of oldTicks) {
      if (tick.recordedAt < tickCutoff) {
        await Q.crypto.price.snapshot.delete({ id: tick.id });
      }
    }
  }

  /** Generate a new random memecoin and send listing notification */
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

  /** Get all active (non-crashed, non-delisted) tokens */
  async getActiveTokens(): Promise<CryptoToken[]> {
    return Q.crypto.token.where({ isCrashed: false }).all();
  }
}
