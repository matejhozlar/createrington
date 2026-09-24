import { z } from "zod";
import { router, publicProcedure } from "@/trpc/trpc";
import { buildPagination, findOrThrow, paginationInput } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { topRoleHolderService } from "@/services/discord/role/top-role-holder.service";
import { Q, playtimeRepo } from "@/db";
import { mcUuid } from "@/utils/zod-schemas";
import {
  LEADERBOARD_BOARDS,
  leaderboardBoardService,
  type BoardRow,
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
  focus: mcUuid.optional(),
  ...paginationInput({ defaultLimit: 25, maxLimit: 100 }),
};

const statInput = {
  category: z.string().min(1).max(128),
  item: z.string().min(1).max(128),
};

function neighbour(row: BoardRow | undefined) {
  return row ? { rank: row.rank, value: row.value } : null;
}

function focusOf(rows: BoardRow[], minecraftUuid: string | undefined) {
  if (!minecraftUuid) return null;
  const index = rows.findIndex((row) => row.minecraftUuid === minecraftUuid);
  if (index === -1) return null;

  const row = rows[index];
  let ahead: BoardRow | undefined;
  for (let i = index - 1; i >= 0 && !ahead; i--) {
    if (rows[i].value > row.value) ahead = rows[i];
  }
  let behind: BoardRow | undefined;
  for (let i = index + 1; i < rows.length && !behind; i++) {
    if (rows[i].value < row.value) behind = rows[i];
  }

  return { row, ahead: neighbour(ahead), behind: neighbour(behind) };
}

function boardPage(
  snapshot: BoardSnapshot,
  input: { search?: string; focus?: string; page: number; limit: number },
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
    topValue: snapshot.rows[0]?.value ?? 0,
    focus: focusOf(snapshot.rows, input.focus),
  };
}

/** Public leaderboards router: the top-role hero, the full ranked boards, per-stat rankings and per-player activity. */
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
        "Returns one page of a fully ranked board (records, playtime or balance) over every player, optionally narrowed by a case-insensitive username search. Ranks are global, so a searched row keeps its real position. Pass focus (a Minecraft UUID) to also get that player's row and the nearest better and worse values wherever they sit",
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
    .input(z.object({ minecraftUuid: mcUuid }))
    .query(({ input }) =>
      Q.player.minecraft.stat.total.getRecordsHeld(input.minecraftUuid),
    ),

  activity: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns a player's daily playtime over the trailing year (seconds per calendar day, summed across servers) with their all-time total, current daily streak, most active weekday and live session length when online. Feeds the expandable activity heatmap on leaderboard rows",
    })
    .input(z.object({ minecraftUuid: mcUuid }))
    .query(async ({ input }) =>
      playtimeRepo.getPlayerActivity(
        await findOrThrow(
          Q.player.find({ minecraftUuid: input.minecraftUuid }),
          "Player not found",
        ),
      ),
    ),
});
