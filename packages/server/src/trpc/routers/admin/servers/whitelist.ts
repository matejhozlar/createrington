import { adminProcedure, router } from "@/trpc/trpc";
import { Q } from "@/db";
import { whitelistService } from "@/services/whitelist";
import { requireServer } from "@/services/mc-server/servers";
import { trpcError, auditActor, serverIdInput } from "@/trpc/utils";

export const serverWhitelistRouter = router({
  resync: adminProcedure
    .meta({
      description:
        "Regenerate the server whitelist from registered players, then reload it via RCON",
    })
    .input(serverIdInput)
    .mutation(async ({ input, ctx }) => {
      const serverConfig = requireServer(input.serverId);

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
});
