import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { trpcError, buildPagination } from "@/trpc/utils";
import { Q } from "@/db";
import { executeBuy, executeSell } from "@/services/crypto/trading/trade-executor";

/** User crypto router — buy/sell tokens, view portfolio and trade history. */
export const cryptoRouter = router({
  buy: userProcedure
    .meta({ description: "Market buy tokens" })
    .input(
      z.object({
        symbol: z.string().min(1).max(10),
        amount: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      try {
        const result = await executeBuy(
          ctx.user.minecraftUuid,
          token,
          BigInt(input.amount),
        );

        return {
          transactionId: result.transactionId,
          symbol: result.symbol,
          type: result.type,
          amount: String(result.amount),
          priceAtExecution: result.priceAtExecution,
          feeAmount: result.feeAmount.toFixed(8),
          totalCost: result.totalCost.toFixed(8),
        };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Trade execution failed",
        );
      }
    }),

  sell: userProcedure
    .meta({ description: "Market sell tokens" })
    .input(
      z.object({
        symbol: z.string().min(1).max(10),
        amount: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      try {
        const result = await executeSell(
          ctx.user.minecraftUuid,
          token,
          BigInt(input.amount),
        );

        return {
          transactionId: result.transactionId,
          symbol: result.symbol,
          type: result.type,
          amount: String(result.amount),
          priceAtExecution: result.priceAtExecution,
          feeAmount: result.feeAmount.toFixed(8),
          totalCost: result.totalCost.toFixed(8),
        };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Trade execution failed",
        );
      }
    }),

  portfolio: userProcedure
    .meta({ description: "Get user's crypto portfolio" })
    .query(async ({ ctx }) => {
      const holdings = await Q.crypto.holding
        .where({ playerMinecraftUuid: ctx.user.minecraftUuid })
        .all();

      if (holdings.length === 0) {
        return {
          holdings: [],
          totalValue: "0",
          totalInvested: "0",
          unrealizedPnl: "0",
          unrealizedPnlPercent: 0,
          tokenCount: 0,
        };
      }

      // Get current token prices for all held tokens
      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      let totalValue = 0;
      let totalInvested = 0;

      const holdingDetails = holdings
        .map((h) => {
          const token = tokenMap.get(h.tokenId);
          if (!token) return null;

          const currentPrice = Number(token.price);
          const amount = Number(h.amount);
          const costBasis = Number(h.totalCostBasis);
          const currentValue = currentPrice * amount;
          const avgBuyPrice = amount > 0 ? costBasis / amount : 0;
          const unrealizedPnl = currentValue - costBasis;
          const unrealizedPnlPercent =
            costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

          totalValue += currentValue;
          totalInvested += costBasis;

          return {
            tokenId: token.id,
            symbol: token.symbol,
            name: token.name,
            category: token.category,
            amount: String(h.amount),
            currentPrice: token.price,
            avgBuyPrice: avgBuyPrice.toFixed(8),
            currentValue: currentValue.toFixed(8),
            totalCostBasis: h.totalCostBasis,
            unrealizedPnl: unrealizedPnl.toFixed(8),
            unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
            isCrashed: token.isCrashed,
          };
        })
        .filter(Boolean);

      const portfolioPnl = totalValue - totalInvested;
      const portfolioPnlPercent =
        totalInvested > 0 ? (portfolioPnl / totalInvested) * 100 : 0;

      return {
        holdings: holdingDetails,
        totalValue: totalValue.toFixed(8),
        totalInvested: totalInvested.toFixed(8),
        unrealizedPnl: portfolioPnl.toFixed(8),
        unrealizedPnlPercent: Number(portfolioPnlPercent.toFixed(2)),
        tokenCount: holdingDetails.length,
      };
    }),

  tradeHistory: userProcedure
    .meta({ description: "Get user's trade history" })
    .input(
      z
        .object({
          page: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(50).default(20),
          symbol: z.string().optional(),
          type: z.enum(["buy", "sell"]).optional(),
        })
        .optional()
        .default({ page: 0, limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const query = Q.crypto.transaction.where({
        playerMinecraftUuid: ctx.user.minecraftUuid,
      });

      const allTx = await query.orderBy("createdAt", "desc").all();

      // Filter in-memory (simple for Phase 1)
      let filtered = allTx;
      if (input.type) {
        filtered = filtered.filter((tx) => tx.type === input.type);
      }

      // Get token map for symbol lookup/filter
      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      if (input.symbol) {
        const upperSymbol = input.symbol.toUpperCase();
        filtered = filtered.filter(
          (tx) => tokenMap.get(tx.tokenId)?.symbol === upperSymbol,
        );
      }

      const total = filtered.length;
      const offset = input.page * input.limit;
      const paginated = filtered.slice(offset, offset + input.limit);

      const items = paginated.map((tx) => {
        const token = tokenMap.get(tx.tokenId);
        return {
          id: tx.id,
          tokenSymbol: token?.symbol ?? "???",
          tokenName: token?.name ?? "Unknown",
          type: tx.type,
          trigger: tx.trigger,
          amount: String(tx.amount),
          priceAtExecution: tx.priceAtExecution,
          feeAmount: tx.feeAmount,
          totalCost: tx.totalCost,
          realizedPnl: tx.realizedPnl,
          createdAt: tx.createdAt.toISOString(),
        };
      });

      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
