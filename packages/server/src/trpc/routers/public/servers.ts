import { router, publicProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { requireServer } from "@/services/mc-server/servers";
import {
  buildServerStatus,
  buildServerStatuses,
  summarizeServerStatuses,
} from "@/services/playtime/server-status";
import { z } from "zod";

export const serversRouter = router({
  list: publicProcedure
    .meta({
      description:
        "Returns all Minecraft servers with their current status, online player list, and a summary of total/online counts. Used on the home page and server list",
    })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
      const servers = buildServerStatuses(manager, buildServerStatus);
      return { servers, summary: summarizeServerStatuses(servers) };
    }),

  get: publicProcedure
    .meta({
      description:
        "Returns a single Minecraft server's status, player list, and connection info by server ID. Throws NOT_FOUND if the server ID doesn't exist in config",
    })
    .input(
      z.object({
        id: z.coerce.number().int().positive().min(1, "Server ID is required"),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = requireServer(input.id);

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const service = manager.getService(input.id);
      const status = buildServerStatus(input.id, serverConfig, service);

      return { server: status };
    }),
});
