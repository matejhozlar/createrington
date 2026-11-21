import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import {
  paginationInput,
  paginateQuery,
  buildPagination,
  playerId,
} from "@/trpc/utils";
import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";

export const transactionsRouter = router({
  list: adminProcedure
    .meta({ description: "Get paginated balance transactions for a player" })
    .input(
      z.object({
        id: playerId(),
        ...paginationInput({ maxLimit: 100, defaultLimit: 20 }),
      }),
    )
    .query(async ({ input }) => {
      const player = await Q.player.find(input.id);
      if (!player)
        return { items: [], pagination: buildPagination(0, input.limit, 0) };

      const { rows, pagination } = await paginateQuery(
        Q.player.balance.transaction,
        { playerMinecraftUuid: player.minecraftUuid },
        input,
        { orderBy: "createdAt", orderDirection: "desc" },
      );

      const items = rows.map((tx) => ({
        id: tx.id,
        amount: BalanceUtils.fromStorage(tx.amount),
        balanceBefore: BalanceUtils.fromStorage(tx.balanceBefore),
        balanceAfter: BalanceUtils.fromStorage(tx.balanceAfter),
        transactionType: tx.transactionType,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      }));

      return { items, pagination };
    }),
});
