import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { db, Q } from "@/db";
import {
  buildPagination,
  findOrThrow,
  paginationInput,
  trpcError,
  auditActor,
} from "@/trpc/utils";
import { idToObject } from "@/app/utils/helpers";
import { mcUuid } from "@/utils/zod-schemas";

/**
 * Admin sub-router for inactivity exemptions. Players on the list are never
 * warned or removed by the inactivity sweep. Not gated to production: the
 * list is plain data and safe to manage on any deployment.
 */
export const exemptionsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Paginated list of players exempt from inactivity cleanup, with optional username search",
    })
    .input(
      z.object({
        search: z.string().optional(),
        ...paginationInput({ defaultLimit: 20, maxLimit: 100 }),
      }),
    )
    .query(async ({ input }) => {
      const { exemptions, total } =
        await Q.player.inactivity.exemption.listWithPlayer({
          search: input.search?.trim() || undefined,
          limit: input.limit,
          offset: input.page * input.limit,
        });

      return {
        exemptions,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  add: adminProcedure
    .meta({
      description:
        "Exempt a player (by Minecraft username, UUID, or Discord ID) from inactivity cleanup; resolves any active warning they have",
    })
    .input(
      z.object({
        player: z.string().trim().min(1, "Player is required"),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = idToObject(input.player);
      if (!identifier) {
        throw trpcError.badRequest(
          "Enter a Minecraft username, UUID, or Discord ID",
        );
      }

      const player = await findOrThrow(
        Q.player.find(identifier),
        "Player not found",
      );

      const { inserted, resolvedWarnings } = await db.inTransaction(
        async (tx) => {
          const inserted = await tx.player.inactivity.exemption.createIfAbsent({
            playerMinecraftUuid: player.minecraftUuid,
            reason: input.reason || null,
            createdByDiscordId: ctx.user.discordId,
          });
          if (!inserted) return { inserted, resolvedWarnings: 0 };

          const resolvedWarnings =
            await tx.player.inactivity.warning.resolveActiveForPlayer(
              player.minecraftUuid,
            );
          return { inserted, resolvedWarnings };
        },
      );

      if (!inserted) {
        throw trpcError.conflict(
          `${player.minecraftUsername} is already exempt`,
        );
      }

      const reasonNote = input.reason ? ` (reason: ${input.reason})` : "";
      const resolvedNote =
        resolvedWarnings > 0
          ? `, resolved ${resolvedWarnings} active warning(s)`
          : "";

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_exemption_add",
        description: `Exempted ${player.minecraftUsername} from inactivity cleanup${reasonNote}${resolvedNote}`,
        targetPlayerUuid: player.minecraftUuid,
        targetPlayerName: player.minecraftUsername,
      });

      return {
        message: `${player.minecraftUsername} exempted`,
        minecraftUsername: player.minecraftUsername,
        resolvedWarnings,
      };
    }),

  remove: adminProcedure
    .meta({
      description:
        "Remove a player's inactivity exemption so the sweep considers them again",
    })
    .input(z.object({ minecraftUuid: mcUuid }))
    .mutation(async ({ input, ctx }) => {
      await findOrThrow(
        Q.player.inactivity.exemption.find({
          playerMinecraftUuid: input.minecraftUuid,
        }),
        "Exemption not found",
      );

      const player = await Q.player.find({
        minecraftUuid: input.minecraftUuid,
      });

      await Q.player.inactivity.exemption.delete({
        playerMinecraftUuid: input.minecraftUuid,
      });

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "inactivity_exemption_remove",
        description: `Removed inactivity exemption for ${
          player?.minecraftUsername ?? input.minecraftUuid
        }`,
        targetPlayerUuid: input.minecraftUuid,
        targetPlayerName: player?.minecraftUsername,
      });

      return { message: "Exemption removed" };
    }),
});
