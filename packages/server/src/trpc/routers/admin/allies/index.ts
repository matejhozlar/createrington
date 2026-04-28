import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";

export const adminAlliesRouter = router({
  fakeParty: adminProcedure
    .meta({ description: "Fake-player party snapshot for a server" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.fake.party.getFakePartyWithMembers(input.serverId);
    }),

  alliedParties: adminProcedure
    .meta({
      description:
        "Real-player parties currently allied with the fake-player party",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.party.getAlliedPartiesWithMembers(input.serverId);
    }),

  qualifiedPlayers: adminProcedure
    .meta({
      description:
        "Players who have met ally trigger requirements (active or pending)",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.qualified.player.getQualifiedPlayers(input.serverId);
    }),

  playerStatus: adminProcedure
    .meta({ description: "Ally status for a single player on a server" })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const [qualification, partyAlliance] = await Promise.all([
        Q.server.ally.qualified.player.getStatusForPlayer(
          input.serverId,
          input.playerUuid,
        ),
        Q.server.ally.qualified.player.getPartyAlliance(
          input.serverId,
          input.playerUuid,
        ),
      ]);
      return { qualification, partyAlliance };
    }),
});
