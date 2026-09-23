import { router, publicProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { topRoleHolderService } from "@/services/discord/role/top-role-holder.service";
import { rankNetWorth } from "@/services/discord/leaderboard/networth";

const BOARD_SIZE = 10;

const leaderboardsReadLimit = createRateLimit({
  name: "public.leaderboards.read",
  limit: 60,
  windowMs: 60 * 1000,
  key: (ctx) => ctx.ip || "anon",
});

/** Public leaderboards router: the top-role hero and the per-metric boards. */
export const leaderboardsRouter = router({
  hero: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns the three competitive top-1 roles (The Unrivaled, The Sleepless, Capitalist) with their current holder, the metric that earned it, when it was claimed and the pre-rendered hero figure. Feeds the leaderboards page hero",
    })
    .query(() => topRoleHolderService.list()),

  boards: publicProcedure
    .use(leaderboardsReadLimit)
    .meta({
      description:
        "Returns the top players by total playtime, in-game balance and #1 stat placements, ten per board. Feeds the boards below the leaderboards hero",
    })
    .query(async () => {
      const [playtime, balances, players, records] = await Promise.all([
        Q.player.playtime.summary.getGlobalLeaderboard(BOARD_SIZE),
        Q.player.balance.getAllBalances(),
        Q.player.getAll(),
        Q.player.minecraft.stats.getRecordLeaderboard(BOARD_SIZE),
      ]);

      const nameByUuid = new Map(
        players.map((p) => [p.minecraftUuid, p.minecraftUsername]),
      );

      return {
        playtime: playtime.map((entry) => ({
          minecraftUuid: entry.playerMinecraftUuid,
          minecraftUsername: entry.minecraftUsername,
          value: entry.totalSeconds,
        })),
        balance: rankNetWorth(balances, nameByUuid, BOARD_SIZE).map(
          (entry) => ({
            minecraftUuid: entry.playerUuid,
            minecraftUsername: entry.playerName,
            value: Number(entry.value),
          }),
        ),
        records: records.rows.map((entry) => ({
          minecraftUuid: entry.minecraftUuid,
          minecraftUsername: entry.minecraftUsername,
          value: entry.records,
        })),
        contestedKeys: records.contestedKeys,
      };
    }),
});
