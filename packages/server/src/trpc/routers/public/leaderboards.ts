import { z } from "zod";
import { router, publicProcedure } from "@/trpc/trpc";
import { buildPagination, paginationInput } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { topRoleHolderService } from "@/services/discord/role/top-role-holder.service";
import {
  LEADERBOARD_BOARDS,
  leaderboardBoardService,
} from "@/services/leaderboard";

const leaderboardsReadLimit = createRateLimit({
  name: "public.leaderboards.read",
  limit: 120,
  windowMs: 60 * 1000,
  key: (ctx) => ctx.ip || "anon",
});

/** Public leaderboards router: the top-role hero and the full ranked boards. */
export const leaderboardsRouter = router({
  hero: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns the three competitive top-1 roles (The Unrivaled, The Sleepless, Capitalist) with their current holder, the metric that earned it, when it was claimed and the pre-rendered hero figure. Feeds the leaderboards page hero",
    })
    .query(() => topRoleHolderService.list()),

  list: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns one page of a fully ranked board (records, playtime or balance) over every player, optionally narrowed by a case-insensitive username search. Ranks are global, so a searched row keeps its real position",
    })
    .input(
      z.object({
        board: z.enum(LEADERBOARD_BOARDS),
        search: z.string().trim().max(32).optional(),
        ...paginationInput({ defaultLimit: 25, maxLimit: 100 }),
      }),
    )
    .query(async ({ input }) => {
      const snapshot = await leaderboardBoardService.getBoard(input.board);
      const needle = input.search?.toLowerCase();
      const matches = needle
        ? snapshot.rows.filter((row) =>
            row.minecraftUsername.toLowerCase().includes(needle),
          )
        : snapshot.rows;
      const offset = input.page * input.limit;

      return {
        rows: matches.slice(offset, offset + input.limit),
        pagination: buildPagination(input.page, input.limit, matches.length),
        contestedKeys: snapshot.contestedKeys,
      };
    }),
});
