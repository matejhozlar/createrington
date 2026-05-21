import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";

/** Sandbox consumer players router: resolves registered player names from Minecraft UUIDs. */
export const sandboxPlayersRouter = router({
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
