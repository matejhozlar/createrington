import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { trpcError, buildPagination } from "@/trpc/utils";
import { Q } from "@/db";
import {
  executeBuy,
  executeSell,
  getCooldownExpiresAt,
} from "@/services/crypto/trading/trade-executor";
import {
  placeOrder,
  cancelOrder,
  getPlayerOrders,
} from "@/services/crypto/trading/order-manager";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/services/crypto/alerts/watchlist-manager";
import {
  getPlayerAlerts,
  createAlert,
  deleteAlert,
} from "@/services/crypto/alerts/alert-manager";
import { getPortfolioHistory } from "@/services/crypto/analytics/portfolio-tracker";
import { evaluateTradeAchievements } from "@/services/crypto/trading/achievement-triggers";
import { CRYPTO_CONFIG } from "@/services/crypto/crypto.config";
import { BalanceUtils } from "@/db/repositories/balance/utils";

/**
 * User Crypto Router
 *
 * Authenticated procedures for trading and account management:
 * - buy / sell: immediate market-price trade execution
 * - placeOrder / cancelOrder / listOrders: limit, stop-loss, and take-profit orders
 * - portfolio: current holdings with unrealized and realized P&L
 * - tradeHistory: paginated transaction log with symbol and type filters
 * - ipoAllocation: remaining per-player allocation cap for an active IPO token
 * - watchlistList / watchlistAdd / watchlistRemove: personal token watchlist
 * - alertList / alertCreate / alertDelete: price-threshold notifications
 * - portfolioHistory: daily portfolio value snapshots
 */
export const cryptoRouter = router({
  balance: userProcedure
    .meta({ description: "Get player's current in-game balance" })
    .query(async ({ ctx }) => {
      const balance = await Q.player.balance.find({
        minecraftUuid: ctx.user.minecraftUuid,
      });
      return {
        balance: String(BalanceUtils.fromStorage(balance?.balance ?? 0n)),
      };
    }),

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

        // Swallow achievement errors: a failed evaluation must not roll back a completed trade
        const newAchievements = await evaluateTradeAchievements(
          ctx.user.minecraftUuid,
          token,
          result,
        ).catch(() => [] as string[]);

        return {
          transactionId: result.transactionId,
          symbol: result.symbol,
          type: result.type,
          amount: String(result.amount),
          priceAtExecution: result.priceAtExecution,
          feeAmount: result.feeAmount.toFixed(8),
          totalCost: result.totalCost.toFixed(8),
          newAchievements,
          cooldownExpiresAt: getCooldownExpiresAt(
            ctx.user.minecraftUuid,
            token.id,
          ),
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

        // Swallow achievement errors: a failed evaluation must not roll back a completed trade
        const newAchievements = await evaluateTradeAchievements(
          ctx.user.minecraftUuid,
          token,
          result,
        ).catch(() => [] as string[]);

        return {
          transactionId: result.transactionId,
          symbol: result.symbol,
          type: result.type,
          amount: String(result.amount),
          priceAtExecution: result.priceAtExecution,
          feeAmount: result.feeAmount.toFixed(8),
          totalCost: result.totalCost.toFixed(8),
          newAchievements,
          cooldownExpiresAt: getCooldownExpiresAt(
            ctx.user.minecraftUuid,
            token.id,
          ),
        };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Trade execution failed",
        );
      }
    }),

  cooldown: userProcedure
    .meta({ description: "Get remaining trade cooldown for a token" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .query(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) return { expiresAt: null };

      const expiresAt = getCooldownExpiresAt(ctx.user.minecraftUuid, token.id);

      return { expiresAt };
    }),

  portfolio: userProcedure
    .meta({ description: "Get user's crypto portfolio" })
    .query(async ({ ctx }) => {
      const holdings = await Q.crypto.holding
        .where({ playerMinecraftUuid: ctx.user.minecraftUuid })
        .all();

      // Calculate cumulative realized P&L from all sells
      const allSells = await Q.crypto.transaction
        .where({
          playerMinecraftUuid: ctx.user.minecraftUuid,
          type: "sell",
        })
        .all();
      const totalRealizedPnl = allSells.reduce(
        (sum, tx) => sum + (tx.realizedPnl ? Number(tx.realizedPnl) : 0),
        0,
      );

      if (holdings.length === 0) {
        return {
          holdings: [],
          totalValue: "0",
          totalInvested: "0",
          unrealizedPnl: "0",
          unrealizedPnlPercent: 0,
          realizedPnl: totalRealizedPnl.toFixed(8),
          tokenCount: 0,
        };
      }

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
        .filter((h): h is NonNullable<typeof h> => h !== null);

      const portfolioPnl = totalValue - totalInvested;
      const portfolioPnlPercent =
        totalInvested > 0 ? (portfolioPnl / totalInvested) * 100 : 0;

      return {
        holdings: holdingDetails,
        totalValue: totalValue.toFixed(8),
        totalInvested: totalInvested.toFixed(8),
        unrealizedPnl: portfolioPnl.toFixed(8),
        unrealizedPnlPercent: Number(portfolioPnlPercent.toFixed(2)),
        realizedPnl: totalRealizedPnl.toFixed(8),
        tokenCount: holdingDetails.length,
      };
    }),

  placeOrder: userProcedure
    .meta({ description: "Place a limit, stop-loss, or take-profit order" })
    .input(
      z.object({
        symbol: z.string().min(1).max(10),
        type: z.enum(["limit_buy", "limit_sell", "stop_loss", "take_profit"]),
        amount: z.number().int().positive(),
        targetPrice: z
          .string()
          .refine((v) => Number(v) > 0, "Price must be positive"),
        expiryHours: z.number().int().min(1).max(168).optional(),
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
        return await placeOrder(
          ctx.user.minecraftUuid,
          token,
          input.type,
          BigInt(input.amount),
          input.targetPrice,
          input.expiryHours,
        );
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Order placement failed",
        );
      }
    }),

  cancelOrder: userProcedure
    .meta({ description: "Cancel a pending order" })
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await cancelOrder(ctx.user.minecraftUuid, input.orderId);
        return { success: true };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Order cancellation failed",
        );
      }
    }),

  listOrders: userProcedure
    .meta({ description: "List user's pending orders" })
    .query(async ({ ctx }) => {
      const orders = await getPlayerOrders(ctx.user.minecraftUuid);

      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      return orders.map((o) => {
        const token = tokenMap.get(o.tokenId);
        return {
          id: o.id,
          tokenId: o.tokenId,
          tokenSymbol: token?.symbol ?? "???",
          tokenName: token?.name ?? "Unknown",
          type: o.type,
          amount: String(o.amount),
          targetPrice: o.targetPrice,
          status: o.status,
          expiresAt: o.expiresAt.toISOString(),
          createdAt: o.createdAt.toISOString(),
        };
      });
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

  ipoAllocation: userProcedure
    .meta({ description: "Get remaining IPO allocation for a token" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .query(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      if (!token.ipoEndsAt || token.ipoEndsAt <= new Date()) {
        return null; // Not in IPO
      }

      const maxAllocation = BigInt(
        Math.floor(
          Number(token.totalSupply) * CRYPTO_CONFIG.IPO_MAX_ALLOCATION_PERCENT,
        ),
      );

      const holding = await Q.crypto.holding
        .where({
          playerMinecraftUuid: ctx.user.minecraftUuid,
          tokenId: token.id,
        })
        .first();

      const currentHeld = holding?.amount ?? 0n;
      const remaining = maxAllocation - currentHeld;

      return {
        maxAllocation: String(maxAllocation),
        currentHeld: String(currentHeld),
        remaining: String(remaining < 0n ? 0n : remaining),
      };
    }),

  watchlistList: userProcedure
    .meta({ description: "Get user's watchlist" })
    .query(async ({ ctx }) => {
      const entries = await getWatchlist(ctx.user.minecraftUuid);
      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      return entries.map((e) => {
        const token = tokenMap.get(e.tokenId);
        return {
          tokenId: e.tokenId,
          symbol: token?.symbol ?? "???",
          name: token?.name ?? "Unknown",
          category: token?.category ?? "memecoin",
          price: token?.price ?? "0",
          addedAt: e.createdAt.toISOString(),
        };
      });
    }),

  watchlistAdd: userProcedure
    .meta({ description: "Add token to watchlist" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      try {
        await addToWatchlist(ctx.user.minecraftUuid, token.id);
        return { success: true };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Failed to add to watchlist",
        );
      }
    }),

  watchlistRemove: userProcedure
    .meta({ description: "Remove token from watchlist" })
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const token = await Q.crypto.token
        .where({ symbol: input.symbol.toUpperCase() })
        .first();

      if (!token) {
        throw trpcError.notFound(`Token ${input.symbol} not found`);
      }

      try {
        await removeFromWatchlist(ctx.user.minecraftUuid, token.id);
        return { success: true };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error
            ? err.message
            : "Failed to remove from watchlist",
        );
      }
    }),

  alertList: userProcedure
    .meta({ description: "List active price alerts" })
    .query(async ({ ctx }) => {
      const alerts = await getPlayerAlerts(ctx.user.minecraftUuid);
      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      return alerts.map((a) => {
        const token = tokenMap.get(a.tokenId);
        return {
          id: a.id,
          tokenId: a.tokenId,
          tokenSymbol: token?.symbol ?? "???",
          tokenName: token?.name ?? "Unknown",
          targetPrice: a.targetPrice,
          direction: a.direction,
          currentPrice: token?.price ?? "0",
          createdAt: a.createdAt.toISOString(),
        };
      });
    }),

  alertCreate: userProcedure
    .meta({ description: "Create a price alert" })
    .input(
      z.object({
        symbol: z.string().min(1).max(10),
        targetPrice: z
          .string()
          .refine((v) => Number(v) > 0, "Price must be positive"),
        direction: z.enum(["above", "below"]),
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
        const alert = await createAlert(
          ctx.user.minecraftUuid,
          token.id,
          input.targetPrice,
          input.direction,
        );

        return {
          id: alert.id,
          tokenSymbol: token.symbol,
          targetPrice: alert.targetPrice,
          direction: alert.direction,
          createdAt: alert.createdAt.toISOString(),
        };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Failed to create alert",
        );
      }
    }),

  alertDelete: userProcedure
    .meta({ description: "Delete a price alert" })
    .input(z.object({ alertId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteAlert(ctx.user.minecraftUuid, input.alertId);
        return { success: true };
      } catch (err) {
        throw trpcError.badRequest(
          err instanceof Error ? err.message : "Failed to delete alert",
        );
      }
    }),

  portfolioHistory: userProcedure
    .meta({ description: "Get daily portfolio value history" })
    .input(
      z
        .object({ limit: z.number().int().min(1).max(365).default(90) })
        .optional()
        .default({ limit: 90 }),
    )
    .query(async ({ ctx, input }) => {
      const snapshots = await getPortfolioHistory(
        ctx.user.minecraftUuid,
        input.limit,
      );

      return snapshots.map((s) => ({
        totalValue: s.totalValue,
        totalInvested: s.totalInvested,
        realizedPnl: s.realizedPnl,
        tokenCount: s.tokenCount,
        recordedAt: s.recordedAt.toISOString(),
      }));
    }),
});
