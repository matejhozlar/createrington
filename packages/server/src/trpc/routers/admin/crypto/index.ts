import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import type { MarketEventType } from "@/services/crypto/events/event-definitions";
import { MEMECOIN_CATALOG } from "@/services/crypto/memecoin/catalog";
import { trpcError } from "@/trpc/utils";

function serializeToken<T extends { totalSupply: bigint; availableSupply: bigint }>(token: T) {
  return {
    ...token,
    totalSupply: String(token.totalSupply),
    availableSupply: String(token.availableSupply),
  };
}

/** Admin crypto router — token management, event triggers, treasury, and market stats. */
export const adminCryptoRouter = router({
  availableMemecoins: adminProcedure
    .meta({
      description: "List memecoin catalog entries not already in the DB",
    })
    .query(async () => {
      const existing = await Q.crypto.token.where({}).all();
      const usedSymbols = new Set(existing.map((t) => t.symbol));
      return MEMECOIN_CATALOG.filter((m) => !usedSymbols.has(m.symbol));
    }),

  createToken: adminProcedure
    .meta({ description: "Create a new memecoin or seasonal token" })
    .input(
      z.object({
        name: z.string().min(1).max(50),
        symbol: z
          .string()
          .min(1)
          .max(10)
          .transform((s) => s.toUpperCase()),
        description: z.string().max(500).optional(),
        category: z.enum(["memecoin", "seasonal"]),
        totalSupply: z.number().int().positive(),
        price: z.number().positive(),
        floorPrice: z.number().positive().optional(),
        delistedAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.category === "memecoin") {
        const catalogEntry = MEMECOIN_CATALOG.find(
          (m) => m.symbol === input.symbol,
        );
        if (!catalogEntry) {
          throw trpcError.badRequest(
            `Symbol ${input.symbol} is not in the memecoin catalog`,
          );
        }
      }

      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const token = await service.createToken({
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        category: input.category,
        totalSupply: BigInt(input.totalSupply),
        price: input.price.toFixed(8),
        floorPrice: input.floorPrice?.toFixed(8),
        delistedAt: input.delistedAt ? new Date(input.delistedAt) : undefined,
      });

      return { token: serializeToken(token) };
    }),

  updateToken: adminProcedure
    .meta({ description: "Update token properties" })
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(500).optional(),
        floorPrice: z.number().positive().nullable().optional(),
        delistedAt: z.string().datetime().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Build update payload explicitly so that null values (clearing a field)
      // are forwarded, while truly absent fields are omitted entirely.
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.floorPrice !== undefined)
        updateData.floorPrice = updates.floorPrice?.toFixed(8) ?? null;
      if (updates.delistedAt !== undefined)
        updateData.delistedAt = updates.delistedAt
          ? new Date(updates.delistedAt)
          : null;

      await Q.crypto.token.update({ id }, updateData);
      const token = await Q.crypto.token.get({ id });

      return { token: serializeToken(token) };
    }),

  delistToken: adminProcedure
    .meta({
      description:
        "Delist a token — auto-sells all holdings at current price and marks as delisted",
    })
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      await service.delistToken(input.id);
      return { message: "Token delisted successfully" };
    }),

  triggerEvent: adminProcedure
    .meta({ description: "Manually trigger a market event" })
    .input(
      z.object({
        eventType: z.enum([
          "bull_run",
          "bear_market",
          "flash_crash",
          "pump_and_dump",
          "liquidity_drought",
          "gold_rush",
          "supply_shock",
          "tax_holiday",
          "whale_dump",
          "new_listing_frenzy",
        ]),
        tokenId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const event = await service.triggerEvent(
        input.eventType as MarketEventType,
        input.tokenId,
      );

      if (!event) {
        return {
          success: false,
          message: "Event could not be triggered (no valid target token found)",
        };
      }

      return {
        success: true,
        event: {
          id: event.eventId,
          type: event.type,
          tokenId: event.tokenId,
          tokenSymbol: event.tokenSymbol,
          activeUntil: event.activeUntil?.toISOString() ?? null,
        },
      };
    }),

  activeEvents: adminProcedure
    .meta({ description: "List currently active market events" })
    .query(async () => {
      const service = await getService(Services.CRYPTO_MARKET_SERVICE);

      const events = service.getActiveEvents();
      return events.map((e) => ({
        id: e.eventId,
        type: e.type,
        tokenId: e.tokenId,
        tokenSymbol: e.tokenSymbol,
        activeUntil: e.activeUntil?.toISOString() ?? null,
        effects: e.effects,
      }));
    }),

  treasury: adminProcedure
    .meta({ description: "View market treasury (collected fees and burned)" })
    .query(async () => {
      const treasury = await Q.crypto.treasury.where({}).first();
      return {
        totalCollected: treasury?.totalCollected ?? "0",
        totalBurned: treasury?.totalBurned ?? "0",
      };
    }),

  marketStats: adminProcedure
    .meta({ description: "Admin market analytics" })
    .query(async () => {
      const tokens = await Q.crypto.token.where({}).all();
      const activeTokens = tokens.filter((t) => !t.isCrashed && !t.delistedAt);
      const crashedTokens = tokens.filter((t) => t.isCrashed);

      // 24h window is computed in-memory from the full transaction set to avoid
      // a parameterised date query; acceptable given expected transaction volume.
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const allTxs = await Q.crypto.transaction.where({}).all();
      const dailyTxs = allTxs.filter((tx) => tx.createdAt >= dayAgo);
      const dailyVolume = dailyTxs.reduce(
        (sum, tx) => sum + Math.abs(Number(tx.totalCost)),
        0,
      );
      const uniqueTraders = new Set(
        dailyTxs.map((tx) => tx.playerMinecraftUuid),
      ).size;

      const totalMarketCap = activeTokens.reduce((sum, t) => {
        return (
          sum + Number(t.price) * Number(t.totalSupply - t.availableSupply)
        );
      }, 0);

      const treasury = await Q.crypto.treasury.where({}).first();

      return {
        totalTokens: tokens.length,
        activeTokens: activeTokens.length,
        crashedTokens: crashedTokens.length,
        totalMarketCap: totalMarketCap.toFixed(2),
        dailyVolume: dailyVolume.toFixed(2),
        dailyTrades: dailyTxs.length,
        totalTrades: allTxs.length,
        uniqueTraders24h: uniqueTraders,
        feesCollected: treasury?.totalCollected ?? "0",
        feesBurned: treasury?.totalBurned ?? "0",
      };
    }),
});
