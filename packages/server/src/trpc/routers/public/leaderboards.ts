import { z } from "zod";
import { router, publicProcedure } from "@/trpc/trpc";
import { buildPagination, paginationInput } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { topRoleHolderService } from "@/services/discord/role/top-role-holder.service";
import { Q } from "@/db";
import {
  LEADERBOARD_BOARDS,
  leaderboardBoardService,
  type BoardSnapshot,
} from "@/services/leaderboard";

const leaderboardsReadLimit = createRateLimit({
  name: "public.leaderboards.read",
  limit: 120,
  windowMs: 60 * 1000,
  key: (ctx) => ctx.ip || "anon",
});

const boardPageInput = {
  search: z.string().trim().max(32).optional(),
  ...paginationInput({ defaultLimit: 25, maxLimit: 100 }),
};

const statInput = {
  category: z.string().min(1).max(128),
  item: z.string().min(1).max(128),
};

function boardPage(
  snapshot: BoardSnapshot,
  input: { search?: string; page: number; limit: number },
) {
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
}

/** Public leaderboards router: the top-role hero, the full ranked boards and per-stat rankings. */
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
    .input(z.object({ board: z.enum(LEADERBOARD_BOARDS), ...boardPageInput }))
    .query(async ({ input }) =>
      boardPage(await leaderboardBoardService.getBoard(input.board), input),
    ),

  searchStats: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Searches individual Minecraft stats (a category such as minecraft:mined plus an item such as minecraft:diamond_ore) by item name, returning only stats at least one player holds, with how many players hold each",
    })
    .input(z.object({ query: z.string().trim().min(1).max(48) }))
    .query(({ input }) => Q.player.minecraft.stat.key.searchStats(input.query)),

  stat: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns one page of the ranking for a single Minecraft stat over every player holding it (values summed across servers), optionally narrowed by a case-insensitive username search. Ranks are global",
    })
    .input(z.object({ ...statInput, ...boardPageInput }))
    .query(async ({ input }) =>
      boardPage(
        await leaderboardBoardService.getStatBoard(input.category, input.item),
        input,
      ),
    ),

  recordsHeld: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Lists the contested stats a player holds the record (#1) in, with their total, how many players hold the stat and the best total of anyone else",
    })
    .input(z.object({ minecraftUuid: z.string().uuid() }))
    .query(({ input }) =>
      Q.player.minecraft.stat.total.getRecordsHeld(input.minecraftUuid),
    ),
});
