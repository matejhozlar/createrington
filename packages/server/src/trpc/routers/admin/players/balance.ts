import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { balanceRepo } from "@/db";
import { parsePlayerId } from "@/trpc/utils";

export const balanceRouter = router({
  get: adminProcedure
    .meta({
      description:
        "Get a player's current balance and recent transactions.",
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
        "Adjust a player's balance. Positive amount adds, negative subtracts.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        amount: z.number().int(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      if (input.amount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount cannot be zero",
        });
      }

      let newBalance: number;

      if (input.amount > 0) {
        newBalance = await balanceRepo.adminGrant(
          identifier,
          input.amount,
          ctx.user.discordId,
          ctx.user.minecraftUsername,
          input.reason,
        );
      } else {
        newBalance = await balanceRepo.adminDeduct(
          identifier,
          Math.abs(input.amount),
          ctx.user.discordId,
          ctx.user.minecraftUsername,
          input.reason,
        );
      }

      return {
        newBalance,
        adjustment: input.amount,
      };
    }),

  bulkAdjust: adminProcedure
    .meta({
      description:
        "Bulk balance adjustment for multiple players at once.",
    })
    .input(
      z.object({
        playerUuids: z
          .array(z.string().min(1))
          .min(1, "At least one player UUID is required"),
        amount: z.number().int(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
