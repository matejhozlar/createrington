import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { paginateQuery, paginationInput } from "@/trpc/utils";

/** Sandbox consumer players router: lists registered players and resolves their names from Minecraft UUIDs. */
export const sandboxPlayersRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Lists every registered player with their Minecraft UUID and username, oldest registration first, one page at a time (zero-based page, up to 1000 per page, default 1000). Banned players are included on purpose: they are welcome on the test server. Walk the pages until page + 1 reaches totalPages. Pages are offset-based, so a player deleted while a consumer walks them shifts later players back by one and one can be skipped; registrations made mid-walk land on the last page. Consumed by the sandbox sync to op all known players on the test server.",
    })
    .input(
      z.object({
        ...paginationInput({ maxLimit: 1000, defaultLimit: 1000 }),
      }),
    )
    .query(async ({ input }) => {
      const { rows, pagination } = await paginateQuery(Q.player, {}, input, {
        orderBy: "id",
        orderDirection: "asc",
      });

      return {
        players: rows.map((p) => ({
          uuid: p.minecraftUuid,
          username: p.minecraftUsername,
        })),
        pagination,
      };
    }),

  resolve: adminProcedure
    .meta({
      description:
        "Resolves a batch of Minecraft UUIDs to registered players. UUIDs with no registered player are omitted from the result. Consumed by the sandbox panel's player inventory manager.",
    })
    .input(
      z.object({
        uuids: z
          .array(z.string().uuid())
          .min(1, "at least one uuid is required")
          .max(1000, "at most 1000 uuids per request"),
      }),
    )
    .query(async ({ input }) => {
      const players = await Q.player.findAll(
        { minecraftUuid: { $in: input.uuids } },
        { select: ["minecraftUuid", "minecraftUsername", "online"] },
      );

      return {
        players: players.map((p) => ({
          uuid: p.minecraftUuid,
          username: p.minecraftUsername,
          online: p.online,
        })),
      };
    }),
});
