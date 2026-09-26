import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { balanceRepo } from "@/db";
import { parsePlayerId, rethrowTrpc, trpcError } from "@/trpc/utils";

const BALANCE_ADJUST_MODES = ["add", "remove", "set"] as const;
const MAX_ADJUSTMENT = 1_000_000_000;
const MAX_REASON_LENGTH = 500;

const hasAtMostCents = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/** Admin balance router: view balance info, adjust individual or bulk balances. */
export const balanceRouter = router({
  get: adminProcedure
    .meta({
      description: "Get a player's current balance and recent transactions.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const balanceInfo = await playerService.core.getBalanceInfo(
        identifier,
        input.limit,
      );

      return {
        balance: {
          ...balanceInfo.balance,
          balance: balanceInfo.balance.balance.toString(),
        },
        formattedBalance: balanceInfo.formattedBalance,
        recentTransactions: balanceInfo.recentTransactions.map((t) => ({
          ...t,
          amount: t.amount.toString(),
          balanceBefore: t.balanceBefore.toString(),
          balanceAfter: t.balanceAfter.toString(),
        })),
      };
    }),

  adjust: adminProcedure
    .meta({
      description:
        "Add to, remove from, or set a player's balance. Amounts are in dollars with up to 2 decimals.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        mode: z.enum(BALANCE_ADJUST_MODES),
        amount: z
          .number()
          .min(0)
          .max(MAX_ADJUSTMENT)
          .refine(hasAtMostCents, "Amount can have at most 2 decimal places"),
        reason: z
          .string()
          .trim()
          .min(1, "Reason is required")
          .max(MAX_REASON_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);
      const { discordId, minecraftUsername } = ctx.user;

      if (input.mode !== "set" && input.amount === 0) {
        throw trpcError.badRequest("Amount must be greater than zero");
      }

      try {
        const args = [
          identifier,
          input.amount,
          discordId,
          minecraftUsername,
          input.reason,
        ] as const;

        const balance =
          input.mode === "add"
            ? await balanceRepo.adminGrant(...args)
            : input.mode === "remove"
              ? await balanceRepo.adminDeduct(...args)
              : await balanceRepo.adminSet(...args);

        return { balance };
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Insufficient balance")
        ) {
          throw trpcError.badRequest(
            "The player doesn't have enough balance to remove that much",
          );
        }
        rethrowTrpc(err);
      }
    }),

  bulkAdjust: adminProcedure
    .meta({
      description: "Bulk balance adjustment for multiple players at once.",
    })
    .input(
      z.object({
        playerUuids: z
          .array(z.string().min(1))
          .min(1, "At least one player UUID is required")
          .max(100, "At most 100 players per bulk adjust"),
        amount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.amount === 0) {
        throw trpcError.badRequest("Amount cannot be zero");
      }

      const results = await playerService.balance.bulkAdjust(
        input.playerUuids,
        input.amount,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      };
    }),
});
