import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { parsePlayerId, paginationInput, buildPagination } from "@/trpc/utils";
import { Q } from "@/db";

/** Admin transactions router — paginated balance transaction history for a player. */
export const transactionsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated balance transactions for a player" })
    .input(
      z.object({
        id: z.string().min(1),
        ...paginationInput({ maxLimit: 100, defaultLimit: 20 }),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const player = await Q.player.find(identifier);
      if (!player)
        return { items: [], pagination: buildPagination(0, input.limit, 0) };

      const [transactions, total] = await Promise.all([
        Q.player.balance.transaction.findAll(
          { playerMinecraftUuid: player.minecraftUuid },
          {
            limit: input.limit,
            offset: input.page * input.limit,
            orderBy: "createdAt",
            orderDirection: "desc",
          },
        ),
        Q.player.balance.transaction.count({
          playerMinecraftUuid: player.minecraftUuid,
        }),
      ]);

      const items = transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount.toString(),
        balanceBefore: tx.balanceBefore.toString(),
        balanceAfter: tx.balanceAfter.toString(),
        transactionType: tx.transactionType,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      }));

      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
