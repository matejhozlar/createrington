import { z } from "zod";
import { router, publicProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { Q } from "@/db";
import { getLeaderboard } from "@/services/crypto/analytics/leaderboard";
import { getRecentEvents } from "@/services/crypto/events/news-feed";
import { getActiveEventsInMemory } from "@/services/crypto/events/event-engine";
import { EVENT_DEFINITIONS } from "@/services/crypto/events/event-definitions";
import { CRYPTO_CONFIG } from "@/services/crypto/crypto.config";
import { getService } from "@/services";
import { Services } from "@/services/container";

/**
 * Public Crypto Router
 *
 * Exposes read-only market data accessible without authentication:
 * - list: paginated token catalogue with optional category/crash filters
 * - get: single token lookup by symbol
 * - priceHistory: OHLCV candlestick snapshots at configurable intervals
 * - marketOverview: aggregate market cap and per-category token counts
 * - leaderboard: top traders ranked by net worth, P&L, or volume
 * - newsFeed: recent persisted market events from the database
 * - activeEvents: live in-memory events currently affecting prices
 * - activeIpo: currently active IPO token with sale progress and per-player cap
 * - tokenDistribution: top-20 holder breakdown for a given token
 */
export const cryptoRouter = router({
  list: publicProcedure
    .meta({ description: "List all active crypto tokens" })
    .input(
      z
        .object({
          category: z
            .enum(["stable", "blue_chip", "memecoin", "seasonal"])
            .optional(),
          includesCrashed: z.boolean().default(false),
        })
        .optional()
        .default({ includesCrashed: false }),
    )
    .query(async ({ input }) => {
      const query = Q.crypto.token.where(
        input.includesCrashed ? {} : { isCrashed: false },
      );

      let tokens = await query.all();

      if (input.category) {
        tokens = tokens.filter((t) => t.category === input.category);
      }

      // Filter out delisted tokens
      tokens = tokens.filter((t) => !t.delistedAt);

      const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);

      return tokens.map((t) => ({
        id: t.id,
        name: t.name,
        symbol: t.symbol,
        description: t.description,
        category: t.category,
        totalSupply: String(t.totalSupply),
        availableSupply: String(t.availableSupply),
        price: t.price,
        floorPrice: t.floorPrice,
        isCrashed: t.isCrashed,
        crashedAt: t.crashedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        delistedAt: t.delistedAt?.toISOString() ?? null,
        ipoEndsAt: t.ipoEndsAt?.toISOString() ?? null,
        ipoPrice: t.ipoPrice,
        metadata: t.metadata,
        change24h: cryptoService.get24hChange(t.id, t.price),
      }));
    }),

  get: publicProcedure
    .meta({ description: "Get single token by symbol" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .query(async ({ input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      return {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        category: token.category,
        totalSupply: String(token.totalSupply),
        availableSupply: String(token.availableSupply),
        price: token.price,
        floorPrice: token.floorPrice,
        isCrashed: token.isCrashed,
        crashedAt: token.crashedAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
        delistedAt: token.delistedAt?.toISOString() ?? null,
        ipoEndsAt: token.ipoEndsAt?.toISOString() ?? null,
        ipoPrice: token.ipoPrice,
        metadata: token.metadata,
      };
    }),

  priceHistory: publicProcedure
    .meta({ description: "Get price history (OHLCV) for a token" })
    .input(
      z.object({
        symbol: z.string().min(1).max(10),
        interval: z.enum(["tick", "minute", "hourly", "daily", "weekly"]),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      const snapshots = await Q.crypto.price.snapshot
        .where({
          tokenId: token.id,
          interval: input.interval,
        })
        .orderBy("recordedAt", "desc")
        .limit(input.limit)
        .all();

      // Return in chronological order
      return snapshots.reverse().map((s) => ({
        time: Math.floor(s.recordedAt.getTime() / 1000),
        open: Number(s.openPrice),
        high: Number(s.highPrice),
        low: Number(s.lowPrice),
        close: Number(s.closePrice),
        volume: Number(s.volume),
      }));
    }),

  marketOverview: publicProcedure
    .meta({ description: "Get global market overview stats" })
    .query(async () => {
      const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
      const activeTokens = tokens.filter((t) => !t.delistedAt);

      const totalMarketCap = activeTokens.reduce((sum, t) => {
        return (
          sum + Number(t.price) * Number(t.totalSupply - t.availableSupply)
        );
      }, 0);

      const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);
      const totalVolume24h = cryptoService.getTotalVolume24h();
      const { topGainer, topLoser } = await cryptoService.getTopMovers();

      return {
        totalMarketCap: totalMarketCap.toFixed(2),
        totalVolume24h: String(totalVolume24h),
        topGainer,
        topLoser,
      };
    }),

  leaderboard: publicProcedure
    .meta({ description: "Get crypto trading leaderboard" })
    .input(
      z.object({
        type: z.enum(["networth", "pnl", "volume"]).default("networth"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      return getLeaderboard(input.type, input.limit);
    }),

  newsFeed: publicProcedure
    .meta({ description: "Get recent market events" })
    .input(
      z
        .object({ limit: z.number().int().min(1).max(50).default(20) })
        .optional()
        .default({ limit: 20 }),
    )
    .query(async ({ input }) => {
      const events = await getRecentEvents(input.limit);
      return events.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        article: e.article,
        tokenId: e.tokenId,
        severity: e.severity,
        metadata: e.metadata,
        activeUntil: e.activeUntil?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      }));
    }),

  activeEvents: publicProcedure
    .meta({ description: "Get currently active market events" })
    .query(() => {
      const events = getActiveEventsInMemory();
      return events.map((e) => {
        // Resolve display metadata from the static definition registry; fall back gracefully if the type is unknown
        const def = EVENT_DEFINITIONS[e.type as keyof typeof EVENT_DEFINITIONS];
        return {
          id: e.eventId,
          type: e.type,
          name: def?.name ?? e.type,
          description: def?.description ?? null,
          tokenId: e.tokenId,
          tokenSymbol: e.tokenSymbol,
          severity: def?.severity ?? "info",
          activeUntil: e.activeUntil?.toISOString() ?? null,
        };
      });
    }),

  activeIpo: publicProcedure
    .meta({ description: "Get the currently active IPO token, if any" })
    .query(async () => {
      const memecoins = await Q.crypto.token
        .where({ category: "memecoin", isCrashed: false })
        .all();

      const now = new Date();
      const ipoToken = memecoins.find((t) => t.ipoEndsAt && t.ipoEndsAt > now);

      if (!ipoToken) return null;

      const totalSold = ipoToken.totalSupply - ipoToken.availableSupply;
      const holders = await Q.crypto.holding
        .where({ tokenId: ipoToken.id })
        .count();
      const maxPerPlayer = Math.floor(
        Number(ipoToken.totalSupply) * CRYPTO_CONFIG.IPO_MAX_ALLOCATION_PERCENT,
      );

      return {
        id: ipoToken.id,
        name: ipoToken.name,
        symbol: ipoToken.symbol,
        description: ipoToken.description,
        category: ipoToken.category,
        price: ipoToken.ipoPrice!,
        totalSupply: String(ipoToken.totalSupply),
        availableSupply: String(ipoToken.availableSupply),
        ipoEndsAt: ipoToken.ipoEndsAt!.toISOString(),
        ipoPrice: ipoToken.ipoPrice!,
        totalSold: String(totalSold),
        participants: holders,
        maxPerPlayer,
      };
    }),

  tokenDistribution: publicProcedure
    .meta({ description: "Get token ownership distribution" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .query(async ({ input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      const holdings = await Q.crypto.holding
        .where({ tokenId: token.id })
        .all();

      const players = await Q.player.where({}).all();
      const nameMap = new Map(
        players.map((p) => [p.minecraftUuid, p.minecraftUsername ?? "Unknown"]),
      );

      const totalHeld = holdings.reduce((sum, h) => sum + h.amount, 0n);

      const holders = holdings
        .map((h) => ({
          playerUuid: h.playerMinecraftUuid,
          playerName: nameMap.get(h.playerMinecraftUuid) ?? "Unknown",
          amount: String(h.amount),
          // Scale by 10 000 in BigInt arithmetic before dividing to preserve two decimal places of precision
          percentage:
            token.totalSupply > 0n
              ? Number((h.amount * 10000n) / token.totalSupply) / 100
              : 0,
        }))
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 20);

      return {
        symbol: token.symbol,
        totalSupply: String(token.totalSupply),
        availableSupply: String(token.availableSupply),
        totalHeld: String(totalHeld),
        holderCount: holdings.length,
        holders,
      };
    }),
});
