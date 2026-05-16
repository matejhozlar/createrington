import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { Q } from "@/db";
import { trpcError } from "@/trpc/utils";

/** Panel consumer presence router: current online player list scoped to one server. */
export const panelPresenceRouter = router({
  onlineByServer: adminProcedure
    .meta({
      description:
        "Returns the currently online players on the server identified by `serverIdentifier`. Consumed by the admin panel to render per-server player lists.",
    })
    .input(
      z.object({
        serverIdentifier: z.string().min(1, "serverIdentifier is required"),
      }),
    )
    .query(async ({ input }) => {
      const serverRow = await Q.server.find({
        identifier: input.serverIdentifier,
      });
      if (!serverRow) {
        throw trpcError.notFound(
          `Server with identifier "${input.serverIdentifier}" not found`,
        );
      }

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
      const service = manager.getService(serverRow.id);
      if (!service) {
        return { players: [] };
      }

      const sessions = service.getActiveSessions();
      return {
        players: sessions.map((s) => ({
          uuid: s.uuid,
          username: s.username,
          sessionStart: s.sessionStart.toISOString(),
        })),
      };
    }),
});
