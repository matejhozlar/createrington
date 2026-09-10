import { router, publicProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { getServerById, MINECRAFT_SERVERS } from "@/services/playtime/config";
import { buildServerStatus } from "@/services/playtime/server-status";
import type { ServerStatus } from "@/services/playtime/server-status";
import { z } from "zod";
import { trpcError } from "@/trpc/utils";

/** Public servers router: server list with status and individual server lookup. */
export const serversRouter = router({
  list: publicProcedure
    .meta({
      description:
        "Returns all Minecraft servers with their current status, online player list, and a summary of total/online counts. Used on the home page and server list",
    })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const servers: ServerStatus[] = [];
      let totalPlayers = 0;
      let onlineServers = 0;

      for (const [serverId, serverConfig] of Object.entries(
        MINECRAFT_SERVERS,
      )) {
        const id = parseInt(serverId, 10);
        const service = manager.getService(id);
        const status = buildServerStatus(id, serverConfig, service);

        if (status.status === "online") {
          onlineServers++;
        }
        totalPlayers += status.playerCount;

        servers.push(status);
      }

      servers.sort((a, b) => a.serverId - b.serverId);

      return {
        servers,
        summary: {
          totalServers: servers.length,
          onlineServers,
          totalPlayers,
        },
      };
    }),

  get: publicProcedure
    .meta({
      description:
        "Returns a single Minecraft server's status, player list, and connection info by server ID. Throws BAD_REQUEST if the server ID doesn't exist in config",
    })
    .input(
      z.object({
        id: z.coerce.number().int().positive().min(1, "Server ID is required"),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.id);
      if (!serverConfig) {
        throw trpcError.badRequest(`Server with id ${input.id} not found`);
      }

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const service = manager.getService(input.id);
      const status = buildServerStatus(input.id, serverConfig, service);

      return { server: status };
    }),
});
