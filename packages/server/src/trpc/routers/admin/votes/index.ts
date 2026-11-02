import { z } from "zod";
import type { PlayerVoteFilters } from "@createrington/shared/db";
import { Q } from "@/db";
import { ilikeContains } from "@/db/utils";
import { settings } from "@/services/settings";
import { adminProcedure, router } from "@/trpc/trpc";
import { paginateQuery, paginationInput } from "@/trpc/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export const adminVotesRouter = router({
  stats: adminProcedure
    .meta({
      description:
        "Server-list vote totals: all time, last 30 days and 24 hours, voters, unlinked and pending votes",
    })
    .query(() => Q.player.vote.getStats()),

  topVoters: adminProcedure
    .meta({
      description:
        "Registered players ranked by vote count, all time or over the last 30 days",
    })
    .input(
      z.object({
        window: z.enum(["all", "30d"]).default("all"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(({ input }) =>
      Q.player.vote.getTopVoters({
        limit: input.limit,
        since:
          input.window === "30d"
            ? new Date(Date.now() - 30 * DAY_MS)
            : undefined,
      }),
    ),

  list: adminProcedure
    .meta({
      description:
        "Stored votes, newest first, with optional username search and paid or pending filter",
    })
    .input(
      z.object({
        search: z.string().trim().max(32).optional(),
        status: z.enum(["all", "paid", "pending", "unlinked"]).default("all"),
        ...paginationInput(),
      }),
    )
    .query(async ({ input }) => {
      const filters: PlayerVoteFilters = {};
      if (input.search) filters.username = ilikeContains(input.search);
      if (input.status === "paid") filters.rewardedAt = { $exists: true };
      if (input.status === "pending") {
        filters.rewardedAt = { $exists: false };
        filters.playerMinecraftUuid = { $exists: true };
      }
      if (input.status === "unlinked") {
        filters.playerMinecraftUuid = { $exists: false };
        filters.rewardedAt = { $exists: false };
      }

      const { rows: votes, pagination } = await paginateQuery(
        Q.player.vote,
        filters,
        input,
        { orderBy: "votedAt", orderDirection: "desc" },
      );
      return { votes, pagination };
    }),

  rewardCommands: adminProcedure
    .meta({
      description:
        "Console commands run for each paid vote and once after each payout",
    })
    .query(() => settings.getVoteRewardCommands()),
});
