import { z } from "zod";
import { router, publicProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { Q } from "@/db";

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
        metadata: t.metadata,
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
      const tokens = await Q.crypto.token
        .where({ isCrashed: false })
        .all();

      const activeTokens = tokens.filter((t) => !t.delistedAt);

      const totalMarketCap = activeTokens.reduce((sum, t) => {
        return sum + Number(t.price) * Number(t.totalSupply - t.availableSupply);
      }, 0);

      return {
        totalMarketCap: totalMarketCap.toFixed(2),
        activeTokens: activeTokens.length,
        tokensByCategory: {
          stable: activeTokens.filter((t) => t.category === "stable").length,
          blue_chip: activeTokens.filter((t) => t.category === "blue_chip")
            .length,
          memecoin: activeTokens.filter((t) => t.category === "memecoin")
            .length,
          seasonal: activeTokens.filter((t) => t.category === "seasonal")
            .length,
        },
      };
    }),
});
