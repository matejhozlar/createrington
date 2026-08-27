import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { whitelistService } from "@/services/whitelist";
import { getServerById } from "@/services/playtime/config";
import { trpcError, auditActor } from "@/trpc/utils";

export const serverWhitelistProcedures = {
  resyncWhitelist: adminProcedure
    .meta({
      description:
        "Delete and regenerate the server whitelist from registered players, then reload it via RCON",
    })
    .input(z.object({ serverId: z.coerce.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const serverConfig = getServerById(input.serverId);
      if (!serverConfig) {
        throw trpcError.badRequest(
          `Server with id ${input.serverId} not found`,
        );
      }

      let count: number;
      try {
        ({ count } = await whitelistService.resync(input.serverId));
      } catch (error) {
        throw trpcError.internal(
          error instanceof Error ? error.message : "Failed to resync whitelist",
        );
      }

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "server_whitelist_resync",
        description: `Resynced whitelist on ${serverConfig.name} (${count} players)`,
        serverId: input.serverId,
      });

      return { count };
    }),
};
